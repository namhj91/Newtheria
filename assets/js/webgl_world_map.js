// 문서 파싱 실패/네트워크 실패 시에는 고정 안내 문구를 표시한다.
const WEBGL_MAP_VERSION_FALLBACK = 'version 불러오기 실패';
const MAP_SIZE = 200;

const canvas = document.getElementById('webglWorldCanvas');
const versionTag = document.getElementById('webglMapVersion');
const regenButton = document.getElementById('webglRegenButton');

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

if (!canvas || !regenButton) {
  throw new Error('WebGL 월드맵 필수 DOM 요소를 찾지 못했습니다.');
}

const worldGenApi = window.NewtheriaWorldGen;
if (!worldGenApi?.generateWorldMap || !worldGenApi?.applyRerollSettingsFromValues) {
  throw new Error('월드 생성 API(window.NewtheriaWorldGen)를 찾지 못했습니다.');
}

const gl = canvas.getContext('webgl', {
  antialias: false,
  depth: false,
  stencil: false,
  alpha: false,
  preserveDrawingBuffer: false
});

if (!gl) {
  throw new Error('WebGL을 지원하지 않는 브라우저/환경입니다.');
}

// 정점 셰이더: 화면을 덮는 두 개 삼각형(quad) 렌더.
const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// 프래그먼트 셰이더: 생성된 타일 텍스처를 반복(repeat) 샘플링해 토러스 월드를 표현.
const FRAGMENT_SHADER_SOURCE = `
  precision highp float;

  varying vec2 v_uv;
  uniform sampler2D u_worldTexture;
  uniform vec2 u_resolution;
  uniform vec2 u_offset;
  uniform float u_zoom;

  void main() {
    vec2 centered = (v_uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
    vec2 worldUv = centered / u_zoom + u_offset;

    // fract를 사용해 텍스처 좌표를 0..1로 래핑하면 경계가 자연스럽게 이어진다.
    vec2 wrappedUv = fract(worldUv);
    vec3 baseColor = texture2D(u_worldTexture, wrappedUv).rgb;

    // 줌아웃 시 타일 경계를 은은하게 확인할 수 있도록 얇은 그리드 보조선을 추가한다.
    vec2 gridUv = fract(worldUv * 40.0);
    float grid = step(gridUv.x, 0.012) + step(gridUv.y, 0.012);
    vec3 color = mix(baseColor, baseColor * 0.82, clamp(grid * 0.06, 0.0, 0.06));

    gl_FragColor = vec4(color, 1.0);
  }
`;

const compileShader = (type, source) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('셰이더 객체 생성에 실패했습니다.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'unknown shader compile error';
    gl.deleteShader(shader);
    throw new Error(`셰이더 컴파일 실패: ${message}`);
  }
  return shader;
};

const createProgram = (vertexSource, fragmentSource) => {
  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('프로그램 객체 생성에 실패했습니다.');

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'unknown program link error';
    gl.deleteProgram(program);
    throw new Error(`프로그램 링크 실패: ${message}`);
  }

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  return program;
};

const program = createProgram(VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
gl.useProgram(program);

const positionLocation = gl.getAttribLocation(program, 'a_position');
const worldTextureLocation = gl.getUniformLocation(program, 'u_worldTexture');
const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
const offsetLocation = gl.getUniformLocation(program, 'u_offset');
const zoomLocation = gl.getUniformLocation(program, 'u_zoom');

const quadBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
  gl.STATIC_DRAW
);
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

const worldTexture = gl.createTexture();
if (!worldTexture) {
  throw new Error('월드 텍스처 객체 생성에 실패했습니다.');
}
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, worldTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
gl.uniform1i(worldTextureLocation, 0);

const camera = {
  zoom: 1.25,
  minZoom: 0.55,
  maxZoom: 9,
  offsetX: 0,
  offsetY: 0,
  dragSensitivity: 0.0018
};

const pointerState = {
  active: false,
  lastX: 0,
  lastY: 0
};

const updateRerollLabels = () => {
  if (seaLevelRatioValue) seaLevelRatioValue.textContent = `${Math.round(Number.parseFloat(seaLevelRatioInput?.value || '0.58') * 100)}%`;
  if (elevationScaleValue) elevationScaleValue.textContent = `${Number.parseFloat(elevationScaleInput?.value || '1').toFixed(2)}x`;
  if (warpStrengthValue) warpStrengthValue.textContent = `${Math.round(Number.parseFloat(warpStrengthInput?.value || '18'))}`;
  if (ridgeStrengthValue) ridgeStrengthValue.textContent = `${Number.parseFloat(ridgeStrengthInput?.value || '0.24').toFixed(2)}`;
  if (riverBudgetScaleValue) riverBudgetScaleValue.textContent = `${Number.parseFloat(riverBudgetScaleInput?.value || '1').toFixed(2)}x`;
};

const syncInputsFromWorldGenConfig = () => {
  const config = worldGenApi.getConfig?.();
  if (!config) return;
  if (seaLevelRatioInput) seaLevelRatioInput.value = `${config.seaLevelRatio}`;
  if (elevationScaleInput) elevationScaleInput.value = `${config.elevationScale}`;
  if (warpStrengthInput) warpStrengthInput.value = `${config.warpStrength}`;
  if (ridgeStrengthInput) ridgeStrengthInput.value = `${config.ridgeStrength}`;
  if (riverBudgetScaleInput) riverBudgetScaleInput.value = `${config.riverBudgetScale}`;
  updateRerollLabels();
};

const readRerollSettingsFromInputs = () => ({
  seaLevelRatio: Number.parseFloat(seaLevelRatioInput?.value || '0.58'),
  elevationScale: Number.parseFloat(elevationScaleInput?.value || '1'),
  warpStrength: Number.parseFloat(warpStrengthInput?.value || '18'),
  ridgeStrength: Number.parseFloat(ridgeStrengthInput?.value || '0.24'),
  riverBudgetScale: Number.parseFloat(riverBudgetScaleInput?.value || '1')
});

const hexToRgb = (hex) => {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3 ? normalized.split('').map((c) => c + c).join('') : normalized;
  const int = Number.parseInt(value, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};

const uploadWorldTexture = (world) => {
  const { width, height, tiles } = world;
  const pixels = new Uint8Array(width * height * 4);

  // 기존 월드 생성 절차 결과(tile.color)를 그대로 텍스처 픽셀로 업로드한다.
  for (let index = 0; index < tiles.length; index += 1) {
    const [r, g, b] = hexToRgb(tiles[index].color);
    const pixelOffset = index * 4;
    pixels[pixelOffset] = r;
    pixels[pixelOffset + 1] = g;
    pixels[pixelOffset + 2] = b;
    pixels[pixelOffset + 3] = 255;
  }

  gl.bindTexture(gl.TEXTURE_2D, worldTexture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
};

const resizeCanvas = () => {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  }
};

const drawFrame = () => {
  resizeCanvas();
  gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
  gl.uniform2f(offsetLocation, camera.offsetX, camera.offsetY);
  gl.uniform1f(zoomLocation, camera.zoom);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  window.requestAnimationFrame(drawFrame);
};

const regenerateWorld = () => {
  worldGenApi.applyRerollSettingsFromValues(readRerollSettingsFromInputs());
  const world = worldGenApi.generateWorldMap(MAP_SIZE, MAP_SIZE);
  uploadWorldTexture(world);
};

canvas.addEventListener('pointerdown', (event) => {
  pointerState.active = true;
  pointerState.lastX = event.clientX;
  pointerState.lastY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!pointerState.active) return;
  const dx = event.clientX - pointerState.lastX;
  const dy = event.clientY - pointerState.lastY;
  pointerState.lastX = event.clientX;
  pointerState.lastY = event.clientY;
  camera.offsetX -= dx * camera.dragSensitivity / camera.zoom;
  camera.offsetY += dy * camera.dragSensitivity / camera.zoom;
});

const endPointerDrag = (event) => {
  if (!pointerState.active) return;
  pointerState.active = false;
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
};

canvas.addEventListener('pointerup', endPointerDrag);
canvas.addEventListener('pointercancel', endPointerDrag);
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const zoomDelta = Math.exp(-event.deltaY * 0.0015);
  camera.zoom = Math.min(camera.maxZoom, Math.max(camera.minZoom, camera.zoom * zoomDelta));
}, { passive: false });

window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() !== 'r') return;
  camera.zoom = 1.25;
  camera.offsetX = 0;
  camera.offsetY = 0;
});

regenButton.addEventListener('click', regenerateWorld);

[seaLevelRatioInput, elevationScaleInput, warpStrengthInput, ridgeStrengthInput, riverBudgetScaleInput].forEach((input) => {
  input?.addEventListener('input', () => {
    updateRerollLabels();
  });
});

const updateVersionLabel = async () => {
  if (!versionTag) return;
  try {
    const response = await fetch('./docs/99_변경이력.md', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const match = text.match(/##\s*(ver\.[^\n]+)/);
    versionTag.textContent = match?.[1] || WEBGL_MAP_VERSION_FALLBACK;
  } catch (error) {
    versionTag.textContent = WEBGL_MAP_VERSION_FALLBACK;
    console.warn('[webgl-world-map] 버전 문자열 로딩 실패', error);
  }
};

syncInputsFromWorldGenConfig();
regenerateWorld();
updateVersionLabel();
window.requestAnimationFrame(drawFrame);
