const WORLD_MAP_BUILDER_VERSION_FALLBACK = 'ver.0.0.82(260420-월드맵작성페이지추가)';

const tabButtons = [...document.querySelectorAll('.tab-button')];
const cardList = document.getElementById('builderCardList');
const versionTag = document.getElementById('worldMapBuilderVersion');

const TAB_CARD_PRESETS = {
  terrain: [
    { route: 'terrain-archipelago', icon: '🏝️', label: '군도형 대륙', desc: '해양 비율이 높은 다도해 중심 지형 구성.' },
    { route: 'terrain-continent', icon: '🗻', label: '거대 대륙권', desc: '넓은 내륙과 산맥 축을 강조한 구성.' },
    { route: 'terrain-frontier', icon: '🌿', label: '개척 변방', desc: '초원·숲·황무지가 고르게 섞인 탐험형 구성.' }
  ],
  climate: [
    { route: 'climate-temperate', icon: '🌤️', label: '온화 순환', desc: '사계절 균형형으로 정착과 탐험이 안정적.' },
    { route: 'climate-monsoon', icon: '🌧️', label: '강우 집중', desc: '우림·습지와 대하천 생성 가능성이 높은 구성.' },
    { route: 'climate-arid', icon: '🔥', label: '건조 격변', desc: '사막과 붉은 협곡 지대가 확대되는 구성.' }
  ],
  special: [
    { route: 'special-world-tree', icon: '🌳', label: '세계수 각성', desc: '세계수·고대성소가 등장하기 쉬운 신성 축.' },
    { route: 'special-dragon', icon: '🐉', label: '용맥 공명', desc: '산악 권역의 용의둥지 발생 확률을 강화.' },
    { route: 'special-crystal', icon: '💎', label: '수정 공명', desc: '수정동굴과 특수 자원 지대를 강조.' }
  ]
};

const setSelectedCard = (tabKey, route) => {
  const storageKey = `world-map-builder:${tabKey}`;
  window.localStorage.setItem(storageKey, route);
};

const readSelectedCard = (tabKey) => {
  const storageKey = `world-map-builder:${tabKey}`;
  return window.localStorage.getItem(storageKey);
};

const renderCardsByTab = (tabKey) => {
  const cardTemplateApi = window.NewtheriaCardTemplates;
  const presets = TAB_CARD_PRESETS[tabKey] || [];
  if (!cardTemplateApi?.renderCardFanCards || !cardList) return;

  const cards = cardTemplateApi.renderCardFanCards(cardList, presets);
  const selectedRoute = readSelectedCard(tabKey);

  cards.forEach((card) => {
    if (selectedRoute && card.dataset.route === selectedRoute) {
      card.classList.add('is-selected');
    }

    card.addEventListener('click', () => {
      cards.forEach((target) => target.classList.remove('is-selected'));
      card.classList.add('is-selected');
      setSelectedCard(tabKey, card.dataset.route || '');
    });
  });
};

const bindTabs = () => {
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      tabButtons.forEach((target) => target.classList.toggle('is-active', target === button));
      renderCardsByTab(button.dataset.tab || 'terrain');
    });
  });
};

const updateVersion = async () => {
  if (!versionTag) return;

  let version = WORLD_MAP_BUILDER_VERSION_FALLBACK;
  try {
    const response = await fetch('./docs/99_변경이력.md', { cache: 'no-store' });
    if (response.ok) {
      const text = await response.text();
      const matched = text.match(/^##\s+(ver\.\d+\.\d+\.\d+\([^\n]+\))/m);
      if (matched?.[1]) {
        version = matched[1].trim();
      }
    }
  } catch (error) {
    console.warn('버전 정보를 가져오지 못했습니다.', error);
  }

  versionTag.textContent = version;
};

const bootstrap = () => {
  bindTabs();
  renderCardsByTab('terrain');
  updateVersion();
};

bootstrap();
