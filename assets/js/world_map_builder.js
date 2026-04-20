const WORLD_MAP_BUILDER_VERSION_FALLBACK = 'ver.0.0.83(260420-월드맵작성페이지신규)';

const tabsRoot = document.getElementById('componentTabs');
const cardListRoot = document.getElementById('componentCardList');
const mapNameMeta = document.getElementById('mapNameMeta');
const mapScaleMeta = document.getElementById('mapScaleMeta');
const mapClimateMeta = document.getElementById('mapClimateMeta');
const versionTag = document.getElementById('worldMapBuilderVersion');

const MAP_COMPONENT_TABS = [
  {
    key: 'topology',
    label: '지형 축',
    meta: {
      name: '아르카디아 프론티어',
      scale: '중형 대륙 · 200x200 헥스 기준',
      climate: '온대 중심 · 고원 분산'
    },
    cards: [
      { route: 'continent-balanced', icon: '🌍', label: '균형 대륙', desc: '해양과 육지 비율이 균형된 안정형 레이아웃입니다.' },
      { route: 'archipelago', icon: '🏝️', label: '군도형', desc: '여러 개의 섬 군집이 흩어진 해양 중심 월드입니다.' },
      { route: 'highland-core', icon: '⛰️', label: '고원 중심', desc: '중심부 고도가 높고 산맥이 자주 연결되는 타입입니다.' }
    ]
  },
  {
    key: 'climate',
    label: '기후 축',
    meta: {
      name: '엘리시움 기후대',
      scale: '세로 장축 · 계절 변화 강조',
      climate: '냉온-열대 다층 기후대'
    },
    cards: [
      { route: 'temperate', icon: '🌤️', label: '온대 중심', desc: '사계절의 균형이 좋아 초반 확장에 유리합니다.' },
      { route: 'arid', icon: '🌵', label: '건조 편향', desc: '사막·붉은 고원 지대가 넓게 형성됩니다.' },
      { route: 'humid', icon: '🌧️', label: '습윤 편향', desc: '숲과 늪, 하천 밀도가 높은 세계가 생성됩니다.' }
    ]
  },
  {
    key: 'civilization',
    label: '문명 축',
    meta: {
      name: '카르디아 문명권',
      scale: '도시권 밀집 · 교역 노선 강조',
      climate: '정착지 친화 · 평원 우세'
    },
    cards: [
      { route: 'scattered-tribe', icon: '🏕️', label: '분산 부족', desc: '소규모 거점이 넓게 퍼져 탐험 중심 진행에 적합합니다.' },
      { route: 'dual-kingdom', icon: '🏰', label: '쌍왕국', desc: '초기부터 경쟁 구도가 생기는 양분형 문명 배치입니다.' },
      { route: 'trade-hub', icon: '⚓', label: '교역 허브', desc: '해안 도시와 항로가 빠르게 성장하는 구조입니다.' }
    ]
  }
];

let activeTabKey = MAP_COMPONENT_TABS[0]?.key || '';

const createTabButton = (tab) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'component-tab';
  button.setAttribute('role', 'tab');
  button.dataset.tab = tab.key;
  button.textContent = tab.label;
  return button;
};

const getActiveTab = () => MAP_COMPONENT_TABS.find((tab) => tab.key === activeTabKey) || MAP_COMPONENT_TABS[0];

const renderMeta = (tab) => {
  if (!tab?.meta) return;
  mapNameMeta.textContent = tab.meta.name;
  mapScaleMeta.textContent = tab.meta.scale;
  mapClimateMeta.textContent = tab.meta.climate;
};

const renderTabs = () => {
  tabsRoot.replaceChildren(...MAP_COMPONENT_TABS.map((tab) => createTabButton(tab)));

  const tabButtons = [...tabsRoot.querySelectorAll('.component-tab')];
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === activeTabKey;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
    button.setAttribute('tabindex', isActive ? '0' : '-1');
  });
};

const renderCards = (tab) => {
  const cardTemplateApi = window.NewtheriaCardTemplates;
  if (!cardTemplateApi?.renderCardFanCards) {
    cardListRoot.innerHTML = '<p>카드 템플릿을 불러오지 못했습니다.</p>';
    return;
  }

  const cards = cardTemplateApi.renderCardFanCards(cardListRoot, tab.cards || []);
  cards.forEach((card) => {
    card.addEventListener('click', () => {
      cards.forEach((c) => c.classList.remove('is-active'));
      card.classList.add('is-active');
    });
  });
};

const updatePage = () => {
  const tab = getActiveTab();
  renderTabs();
  renderMeta(tab);
  renderCards(tab);
};

const bindEvents = () => {
  tabsRoot.addEventListener('click', (event) => {
    const button = event.target.closest('.component-tab');
    if (!button) return;
    activeTabKey = button.dataset.tab || activeTabKey;
    updatePage();
  });
};

const updateVersionTag = async () => {
  let version = WORLD_MAP_BUILDER_VERSION_FALLBACK;

  try {
    const response = await fetch('./docs/99_변경이력.md', { cache: 'no-store' });
    if (response.ok) {
      const changelogText = await response.text();
      const matched = changelogText.match(/^##\s+(ver\.[^\n]+)/m);
      if (matched?.[1]) {
        version = matched[1].trim();
      }
    }
  } catch (error) {
    console.warn('변경 이력에서 버전 정보를 불러오지 못했습니다.', error);
  }

  versionTag.textContent = version;
};

const bootstrap = async () => {
  bindEvents();
  updatePage();
  await updateVersionTag();
};

bootstrap();
