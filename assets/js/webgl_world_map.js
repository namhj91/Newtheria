// 문서 파싱 실패/네트워크 실패 시에는 고정 안내 문구를 표시한다.
const WEBGL_MAP_VERSION_FALLBACK = 'version 불러오기 실패';

const canvas = document.getElementById('webglWorldCanvas');
const versionTag = document.getElementById('webglMapVersion');

if (!canvas) {
  throw new Error('webglWorldCanvas 요소를 찾지 못했습니다.');
}

const gl = canvas.getContext('webgl', {
  antialias: true,
  depth: false,
  stencil: false,
  alpha: false,
  preserveDrawingBuffer: false
});

if (!gl) {
  throw new Error('WebGL을 지원하지 않는 브라우저/환경입니다.');
}

// 화면 전체를 그릴 정점 셰이더.
// 두 개의 삼각형으로 클립스페이스를 꽉 채운다.
const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// 월드맵 지형을 절차적으로 생성하는 프래그먼트 셰이더.
// fBM 노이즈와 해수면 임계값으로 대륙/바다를 분리한다.
const FRAGMENT_SHADER_SOURCE = `
  precision highp float;

  varying vec2 v_uv;
  uniform vec2 u_resolution;
  uniform vec2 u_offset;
  uniform float u_zoom;
  uniform float u_time;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 6; i++) {
      value += noise(p * frequency) * amplitude;
      frequency *= 2.0;
      amplitude *= 0.5;
    }

    return value;
  }

  vec3 oceanColor(float depth) {
    vec3 deepOcean = vec3(0.04, 0.15, 0.32);
    vec3 shallowOcean = vec3(0.09, 0.36, 0.64);
    return mix(shallowOcean, deepOcean, smoothstep(0.0, 1.0, depth));
  }

  vec3 landColor(float height, float heat) {
    vec3 coast = vec3(0.82, 0.77, 0.56);
    vec3 plains = vec3(0.25, 0.56, 0.28);
    vec3 forest = vec3(0.12, 0.37, 0.21);
    vec3 mountain = vec3(0.45, 0.46, 0.44);
    vec3 snow = vec3(0.91, 0.94, 0.98);

    vec3 low = mix(coast, plains, smoothstep(0.46, 0.54, height));
    vec3 mid = mix(low, forest, smoothstep(0.57, 0.72, height));
    vec3 high = mix(mid, mountain, smoothstep(0.73, 0.88, height));
    vec3 snowy = mix(high, snow, smoothstep(0.86, 0.98, height + (1.0 - heat) * 0.2));

    return snowy;
  }

  void main() {
    vec2 centered = (v_uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
    vec2 worldUv = centered / u_zoom + u_offset;

    // 대륙 모양은 저주파 + 고주파를 혼합해 결정한다.
    float largeShape = fbm(worldUv * 1.35);
    float detailShape = fbm(worldUv * 4.0 + vec2(3.7, 9.2));
    float ridge = abs(noise(worldUv * 7.2 + vec2(4.0, 8.0)) * 2.0 - 1.0);

    float elevation = largeShape * 0.73 + detailShape * 0.22 + (1.0 - ridge) * 0.05;
    float heat = fbm(worldUv * 2.1 + vec2(11.0, -7.0) + u_time * 0.008);
    float seaLevel = 0.52;

    vec3 color;
    if (elevation < seaLevel) {
      float depth = (seaLevel - elevation) / seaLevel;
      color = oceanColor(depth);

      // 해안선 근처에 얕은 물 색을 살짝 섞어 윤곽을 강조한다.
      float coastBand = smoothstep(0.0, 0.035, seaLevel - elevation);
      color = mix(vec3(0.2, 0.56, 0.78), color, coastBand);
    } else {
      color = landColor(elevation, heat);
    }

    // 격자 보조선(아주 은은하게): 월드 좌표 감각을 제공한다.
    vec2 gridUv = fract(worldUv * 10.0);
    float grid = step(gridUv.x, 0.01) + step(gridUv.y, 0.01);
    color = mix(color, color * 0.82, clamp(grid * 0.08, 0.0, 0.08));

    gl_FragColor = vec4(color, 1.0);
  }
`;

const compileShader = (type, source) => {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('셰이더 객체 생성에 실패했습니다.');
  }

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
  if (!program) {
    throw new Error('프로그램 객체 생성에 실패했습니다.');
  }

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
const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
const offsetLocation = gl.getUniformLocation(program, 'u_offset');
const zoomLocation = gl.getUniformLocation(program, 'u_zoom');
const timeLocation = gl.getUniformLocation(program, 'u_time');

const quadBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    -1, 1,
    1, -1,
    1, 1
  ]),
  gl.STATIC_DRAW
);

gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

const camera = {
  zoom: 1.2,
  minZoom: 0.55,
  maxZoom: 8,
  offsetX: 0,
  offsetY: 0,
  dragSensitivity: 0.0022
};

const pointerState = {
  active: false,
  lastX: 0,
  lastY: 0
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

const drawFrame = (timeMs) => {
  resizeCanvas();

  gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
  gl.uniform2f(offsetLocation, camera.offsetX, camera.offsetY);
  gl.uniform1f(zoomLocation, camera.zoom);
  gl.uniform1f(timeLocation, timeMs * 0.001);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
  window.requestAnimationFrame(drawFrame);
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

  // 줌이 클수록 이동량을 줄여서 시점 제어를 안정화한다.
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
  camera.zoom = 1.2;
  camera.offsetX = 0;
  camera.offsetY = 0;
});

const updateVersionLabel = async () => {
  if (!versionTag) return;

  try {
    const response = await fetch('./docs/99_변경이력.md');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    const match = text.match(/##\s*(ver\.[^\n]+)/);
    versionTag.textContent = match?.[1] || WEBGL_MAP_VERSION_FALLBACK;
  } catch (error) {
    versionTag.textContent = WEBGL_MAP_VERSION_FALLBACK;
    console.warn('[webgl-world-map] 버전 문자열 로딩 실패', error);
  }
};

updateVersionLabel();
window.requestAnimationFrame(drawFrame);
