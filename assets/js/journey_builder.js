const steps = [...document.querySelectorAll('.journey-step')];
const panels = [...document.querySelectorAll('.journey-panel')];

const prologueLog = document.getElementById('prologueLog');
const prologueStartBtn = document.getElementById('prologueStartBtn');
const worldNameInput = document.getElementById('worldNameInput');
const worldSeedInput = document.getElementById('worldSeedInput');
const worldToneSelect = document.getElementById('worldToneSelect');
const worldGenerateBtn = document.getElementById('worldGenerateBtn');
const worldSummary = document.getElementById('worldSummary');
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

const generateWorld = () => {
  const worldName = worldNameInput.value.trim() || '이름 없는 신생 대륙';
  const fallbackSeed = Math.floor(Date.now() % 999999) + 1;
  const seed = Number(worldSeedInput.value) || fallbackSeed;
  const tone = worldToneSelect.value;
  const random = createSeededRandom(seed);

  const temperature = Math.floor(20 + random() * 35);
  const danger = Math.floor(25 + random() * 70);
  const manaDensity = Math.floor(15 + random() * 80);

  state.world = { worldName, seed, tone, temperature, danger, manaDensity };

  worldSummary.innerHTML = `
    <p><strong>${worldName}</strong> 생성 완료</p>
    <p>시드: ${seed} / 대륙 성향: ${tone}</p>
    <p>평균 기온: ${temperature}°C · 위험도: ${danger} · 마력 농도: ${manaDensity}</p>
  `;

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
