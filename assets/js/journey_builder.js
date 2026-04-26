const steps = [...document.querySelectorAll('.journey-step')];
const panels = [...document.querySelectorAll('.journey-panel')];

const prologueDoneBtn = document.getElementById('prologueDoneBtn');
const worldDoneBtn = document.getElementById('worldDoneBtn');
const historySimulateBtn = document.getElementById('historySimulateBtn');
const historyTimeline = document.getElementById('historyTimeline');
const characterNameInput = document.getElementById('characterNameInput');
const characterOriginSelect = document.getElementById('characterOriginSelect');
const characterTraitSelect = document.getElementById('characterTraitSelect');
const finalizeJourneyBtn = document.getElementById('finalizeJourneyBtn');
const journeyResult = document.getElementById('journeyResult');

// 단계 간 상태 공유 객체.
// 프롤로그/월드 생성은 기존 페이지(iframe) 그대로 쓰고,
// 이후 단계(역사/캐릭터)는 이 페이지 상태에서 이어 받는다.
const state = {
  currentStep: 1,
  worldSnapshot: null,
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

const createSeededRandom = (seed) => {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
};

const markPrologueDone = () => {
  setStep(2);
};

const markWorldDone = () => {
  // 월드맵 페이지 내부 구현에 강결합하지 않도록, 최소 스냅샷만 유지한다.
  // 실제 월드 데이터 연동 API가 생기면 이 부분에서 postMessage/공용 저장소로 확장한다.
  state.worldSnapshot = {
    capturedAt: new Date().toISOString(),
    source: 'world_map.html'
  };
  setStep(3);
};

const simulateHistory = () => {
  // 세계를 먼저 만들도록 가드한다.
  if (!state.worldSnapshot) {
    historyTimeline.innerHTML = '<li>먼저 2단계에서 세계 생성을 완료해 주세요.</li>';
    return;
  }

  const numericSeed = Number(state.worldSnapshot.capturedAt.replace(/[^0-9]/g, '').slice(-9)) || 777777;
  const random = createSeededRandom(numericSeed);
  const events = [
    '수도 연합이 성립되고 대륙 공용력이 제정됨',
    '대륙 북부 변방에서 군벌 충돌이 장기화됨',
    '항로 개척 이후 교역 길드가 급성장함',
    '성소 복원 사업으로 마력 인프라가 안정화됨',
    '변이 마수 파동으로 변경 요새선이 강화됨'
  ];

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
  if (!state.worldSnapshot || state.history.length === 0) {
    journeyResult.innerHTML = '<p>세계 생성/역사 시뮬레이션을 먼저 완료해 주세요.</p>';
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
    <p>세계 생성 시각: ${new Date(state.worldSnapshot.capturedAt).toLocaleString('ko-KR')}</p>
    <p>최근 역사 사건: ${latestEvent.year}년, ${latestEvent.event}</p>
  `;
};

prologueDoneBtn?.addEventListener('click', markPrologueDone);
worldDoneBtn?.addEventListener('click', markWorldDone);
historySimulateBtn?.addEventListener('click', simulateHistory);
finalizeJourneyBtn?.addEventListener('click', finalizeJourney);
