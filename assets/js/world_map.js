const canvas = document.getElementById('worldCanvas');
const ctx = canvas.getContext('2d');
const backButton = document.getElementById('goBack');
const statsEl = document.getElementById('mapStats');

const WORLD = {
  cols: 200,
  rows: 200,
  hexSize: 10,
  terrainPalette: {
    plain: '#4a7f4f',
    forest: '#2d6b45',
    hill: '#7b6c4e',
    mountain: '#8c8f99',
    desert: '#a4864f',
    water: '#2f5f93'
  }
};

const CAMERA = {
  x: 100,
  y: 70,
  zoom: 1,
  minZoom: 0.35,
  maxZoom: 2.8
};

const STATE = {
  dragging: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  startCamX: 0,
  startCamY: 0
};

const SQRT3 = Math.sqrt(3);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const pickTerrain = (q, r) => {
  const n = Math.sin((q * 0.19) + (r * 0.23)) + Math.cos((q * 0.14) - (r * 0.09));
  if (n > 1.2) return 'mountain';
  if (n > 0.58) return 'hill';
  if (n > 0.08) return 'forest';
  if (n < -1.08) return 'water';
  if (n < -0.52) return 'desert';
  return 'plain';
};

const hexToPixel = (q, r) => {
  const x = WORLD.hexSize * (1.5 * q);
  const y = WORLD.hexSize * (SQRT3 * (r + q / 2));
  return { x, y };
};

const worldBounds = () => {
  const last = hexToPixel(WORLD.cols - 1, WORLD.rows - 1);
  const minX = -WORLD.hexSize;
  const minY = -WORLD.hexSize;
  const maxX = last.x + (WORLD.hexSize * 2);
  const maxY = last.y + (WORLD.hexSize * 2);
  return { minX, minY, maxX, maxY };
};

const resize = () => {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
};

const drawHex = (x, y, fill) => {
  const s = WORLD.hexSize;

  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i);
    const px = x + (s * Math.cos(angle));
    const py = y + (s * Math.sin(angle));
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(190, 214, 255, 0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();
};

const draw = () => {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#081125';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(CAMERA.x, CAMERA.y);
  ctx.scale(CAMERA.zoom, CAMERA.zoom);

  const bounds = worldBounds();
  const left = (-CAMERA.x) / CAMERA.zoom - (WORLD.hexSize * 2);
  const top = (-CAMERA.y) / CAMERA.zoom - (WORLD.hexSize * 2);
  const right = left + (width / CAMERA.zoom) + (WORLD.hexSize * 4);
  const bottom = top + (height / CAMERA.zoom) + (WORLD.hexSize * 4);

  if (right > bounds.minX && left < bounds.maxX && bottom > bounds.minY && top < bounds.maxY) {
    for (let q = 0; q < WORLD.cols; q += 1) {
      for (let r = 0; r < WORLD.rows; r += 1) {
        const point = hexToPixel(q, r);
        if (point.x < left || point.x > right || point.y < top || point.y > bottom) continue;
        const terrain = pickTerrain(q, r);
        drawHex(point.x, point.y, WORLD.terrainPalette[terrain]);
      }
    }
  }

  ctx.restore();

  statsEl.textContent = `${WORLD.cols} × ${WORLD.rows} 헥스 (${(WORLD.cols * WORLD.rows).toLocaleString()}타일)`;
};

const onPointerDown = (e) => {
  STATE.dragging = true;
  STATE.pointerId = e.pointerId;
  STATE.startX = e.clientX;
  STATE.startY = e.clientY;
  STATE.startCamX = CAMERA.x;
  STATE.startCamY = CAMERA.y;
  canvas.setPointerCapture(e.pointerId);
};

const onPointerMove = (e) => {
  if (!STATE.dragging || STATE.pointerId !== e.pointerId) return;
  const dx = e.clientX - STATE.startX;
  const dy = e.clientY - STATE.startY;
  CAMERA.x = STATE.startCamX + dx;
  CAMERA.y = STATE.startCamY + dy;
  draw();
};

const onPointerUp = (e) => {
  if (STATE.pointerId !== e.pointerId) return;
  STATE.dragging = false;
  canvas.releasePointerCapture(e.pointerId);
};

const onWheel = (e) => {
  e.preventDefault();
  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
  const nextZoom = clamp(CAMERA.zoom * zoomFactor, CAMERA.minZoom, CAMERA.maxZoom);

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const worldX = (mouseX - CAMERA.x) / CAMERA.zoom;
  const worldY = (mouseY - CAMERA.y) / CAMERA.zoom;

  CAMERA.zoom = nextZoom;
  CAMERA.x = mouseX - (worldX * CAMERA.zoom);
  CAMERA.y = mouseY - (worldY * CAMERA.zoom);

  draw();
};

const resetView = () => {
  CAMERA.x = 100;
  CAMERA.y = 70;
  CAMERA.zoom = 1;
  draw();
};

const bindEvents = () => {
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', resetView);
  window.addEventListener('resize', resize);

  backButton.addEventListener('click', () => {
    window.location.href = './start_screen.html';
  });
};

const bootstrap = () => {
  bindEvents();
  resize();
};

bootstrap();
