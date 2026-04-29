const steps = [...document.querySelectorAll('.journey-step')];
const panels = [...document.querySelectorAll('.journey-panel')];

const prologueLog = document.getElementById('prologueLog');
const prologueStartBtn = document.getElementById('prologueStartBtn');
const worldNameInput = document.getElementById('worldNameInput');
const worldSeedInput = document.getElementById('worldSeedInput');
const worldToneSelect = document.getElementById('worldToneSelect');
const worldGenerateBtn = document.getElementById('worldGenerateBtn');
const worldSummary = document.getElementById('worldSummary');
const worldMapPreview = document.getElementById('worldMapPreview');
const historySimulateBtn = document.getElementById('historySimulateBtn');
const historyTimeline = document.getElementById('historyTimeline');
const characterNameInput = document.getElementById('characterNameInput');
const characterOriginSelect = document.getElementById('characterOriginSelect');
const characterTraitSelect = document.getElementById('characterTraitSelect');
const finalizeJourneyBtn = document.getElementById('finalizeJourneyBtn');
const journeyResult = document.getElementById('journeyResult');

// 한 페이지 흐름에서 단계 간 데이터를 공유하기 위한 단일 상태 객체.
const state = {
  currentStep: 1,
  world: null,
  worldTiles: [],
  history: [],
  character: null
};

const setStep = (nextStep) => {
  state.currentStep = nextStep;
  steps.forEach((step) => {
    step.classList.toggle('is-active', Number(step.dataset.step) === nextStep);
  });
  panels.forEach((panel) => {
    panel.classList.toggle('is-active', Number(panel.dataset.panel) === nextStep);
  });
};

// 재현 가능한 생성 결과를 위해 가벼운 시드 기반 난수기를 사용한다.
const createSeededRandom = (seed) => {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
};

const runPrologue = () => {
  const lines = [
    '성소의 종이 세 번 울리고, 밤하늘에 금이 갔습니다.',
    '아스테리아가 당신에게 세계의 틈을 봉인할 사명을 맡깁니다.',
    '당신은 별지도를 품고 미지의 대륙으로 발을 내딛습니다.'
  ];

  prologueLog.innerHTML = lines.map((line) => `<p>• ${line}</p>`).join('');
  setStep(2);
};



// 월드맵 미리보기 렌더러
// - 임베드/라우팅 없이 이 뷰 안에서 생성 결과를 즉시 확인한다.
// - 육각형(odd-r 오프셋) 타일을 간단 색상 규칙으로 렌더해 생성 단계를 가시화한다.
const renderWorldMapPreview = () => {
  if (!worldMapPreview || !state.world || state.worldTiles.length === 0) return;

  const ctx = worldMapPreview.getContext('2d');
  if (!ctx) return;

  const canvasWidth = worldMapPreview.width;
  const canvasHeight = worldMapPreview.height;
  const cols = state.world.cols;
  const rows = state.world.rows;
  const size = Math.min(canvasWidth / (cols * 1.75), canvasHeight / (rows * 1.4));
  const hexWidth = size * Math.sqrt(3);
  const hexHeight = size * 2;

  const colors = {
    ocean: '#2563eb',
    coast: '#38bdf8',
    plains: '#84cc16',
    forest: '#22c55e',
    mountain: '#a1a1aa'
  };

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const drawHex = (centerX, centerY, radius, fillStyle) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 180) * (60 * i - 30);
      const px = centerX + radius * Math.cos(angle);
      const py = centerY + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  state.worldTiles.forEach((tile) => {
    const offsetX = tile.row % 2 ? hexWidth / 2 : 0;
    const x = 24 + tile.col * hexWidth + offsetX;
    const y = 24 + tile.row * (hexHeight * 0.75);
    drawHex(x, y, size - 1.2, colors[tile.terrain] || '#475569');
  });
};

const generateWorld = () => {
  const worldName = worldNameInput.value.trim() || '이름 없는 신생 대륙';
  const fallbackSeed = Math.floor(Date.now() % 999999) + 1;
  const seed = Number(worldSeedInput.value) || fallbackSeed;
  const tone = worldToneSelect.value;
  const random = createSeededRandom(seed);

  // 월드맵 제작 뷰 전용 해상도(헥스 그리드)
  const cols = 24;
  const rows = 14;

  const temperature = Math.floor(20 + random() * 35);
  const danger = Math.floor(25 + random() * 70);
  const manaDensity = Math.floor(15 + random() * 80);

  state.world = { worldName, seed, tone, temperature, danger, manaDensity, cols, rows };

  // 실제 월드맵 제네레이션 단계
  // 1) 고도 노이즈 생성 → 2) 대륙 성향별 임계치 보정 → 3) 타일 지형 결정
  const toneBias = tone === 'wild' ? 0.06 : tone === 'arcane' ? -0.04 : 0;
  state.worldTiles = Array.from({ length: rows * cols }, (_, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const elevation = random() + toneBias + (random() - 0.5) * 0.24;

    let terrain = 'ocean';
    if (elevation > 0.74) terrain = 'mountain';
    else if (elevation > 0.58) terrain = 'forest';
    else if (elevation > 0.45) terrain = 'plains';
    else if (elevation > 0.38) terrain = 'coast';

    return { col, row, elevation, terrain };
  });

  worldSummary.innerHTML = `
    <p><strong>${worldName}</strong> 월드맵 제작 완료</p>
    <p>시드: ${seed} / 대륙 성향: ${tone}</p>
    <p>평균 기온: ${temperature}°C · 위험도: ${danger} · 마력 농도: ${manaDensity}</p>
    <p>헥스 크기: ${cols} × ${rows} (${cols * rows} 타일)</p>
  `;

  renderWorldMapPreview();
  setStep(3);
};

const simulateHistory = () => {
  if (!state.world) {
    historyTimeline.innerHTML = '<li>먼저 세계를 생성해 주세요.</li>';
    return;
  }

  const random = createSeededRandom(state.world.seed + 77);
  const events = [
    '왕조가 통합되어 중앙 의회가 수립됨',
    '북부 균열 지대에서 마수 대이동 발생',
    '대륙 횡단 항로 개척으로 교역 황금기 도래',
    '별조각 신전 발굴로 고대 기술 복원',
    '동부 고원에서 독립 전쟁이 발발'
  ];

  // 120년을 4개 시대로 압축해 초기 세계사 배경을 만든다.
  state.history = Array.from({ length: 4 }, (_, index) => {
    const year = (index + 1) * 30;
    const event = events[Math.floor(random() * events.length)];
    return { year, event };
  });

  historyTimeline.innerHTML = state.history
    .map(({ year, event }) => `<li>${year}년: ${event}</li>`)
    .join('');

  setStep(4);
};

const finalizeJourney = () => {
  if (!state.world || state.history.length === 0) {
    journeyResult.innerHTML = '<p>세계 생성과 역사 시뮬레이션을 먼저 완료해 주세요.</p>';
    return;
  }

  const characterName = characterNameInput.value.trim() || '이름 없는 순례자';
  const origin = characterOriginSelect.selectedOptions[0]?.textContent?.trim() || '미상';
  const coreTrait = characterTraitSelect.selectedOptions[0]?.textContent?.trim() || '중립';

  state.character = { characterName, origin, coreTrait };

  const latestEvent = state.history[state.history.length - 1];

  journeyResult.innerHTML = `
    <p><strong>${characterName}</strong>의 여정이 시작됩니다.</p>
    <p>출신: ${origin} / 핵심 성향: ${coreTrait}</p>
    <p>배경 세계: ${state.world.worldName} (시드 ${state.world.seed})</p>
    <p>최근 역사 사건: ${latestEvent.year}년, ${latestEvent.event}</p>
  `;
};

prologueStartBtn?.addEventListener('click', runPrologue);
worldGenerateBtn?.addEventListener('click', generateWorld);
historySimulateBtn?.addEventListener('click', simulateHistory);
finalizeJourneyBtn?.addEventListener('click', finalizeJourney);
