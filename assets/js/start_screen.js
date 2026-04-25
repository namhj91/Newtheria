const menu = document.getElementById('menu');
let cards = [];
let isMobileViewport = false;
// [관리자 디버그 모드]
// - 코드에서 기본값을 바꾸려면 ADMIN_DEBUG_MODE_DEFAULT 값을 수정한다.
// - 런타임에서 즉시 켜고/끄려면 localStorage(newtheria.adminDebugMode)에 true/false를 저장한다.
// - 우선 디버깅 지속이 필요하므로 기본값은 true다.
const ADMIN_DEBUG_MODE_DEFAULT = true;
const ADMIN_DEBUG_STORAGE_KEY = 'newtheria.adminDebugMode';

const loadAdminDebugMode = () => {
  try {
    const storedValue = window.localStorage?.getItem(ADMIN_DEBUG_STORAGE_KEY);
    if (storedValue == null) return ADMIN_DEBUG_MODE_DEFAULT;
    if (storedValue === 'true') return true;
    if (storedValue === 'false') return false;
  } catch (error) {
    console.warn('관리자 디버그 모드(localStorage) 값을 읽지 못했습니다.', error);
  }
  return ADMIN_DEBUG_MODE_DEFAULT;
};

const persistAdminDebugMode = (enabled) => {
  try {
    window.localStorage?.setItem(ADMIN_DEBUG_STORAGE_KEY, String(Boolean(enabled)));
  } catch (error) {
    console.warn('관리자 디버그 모드(localStorage) 값을 저장하지 못했습니다.', error);
  }
};

let adminDebugMode = loadAdminDebugMode();
// 문서 파싱 실패/네트워크 실패 시에는 고정 안내 문구를 표시한다.
// 매 PR마다 fallback 버전 문자열을 수동 갱신하지 않기 위한 정책이다.
const START_VERSION_FALLBACK = 'version 불러오기 실패';
const STORAGE_KEYS = {
  characterCatalog: 'newtheria.characters',
  settingsMeta: 'newtheria.settings.meta',
  saveSlotsMeta: 'newtheria.saveSlots.meta',
  saveSlotsData: 'newtheria.saveSlots.data'
};

const CARD_MENU_ITEMS = [
  { route: 'new', icon: '🧭', label: '새로운 여정', desc: '처음부터 새로운 세계를 시작합니다.' },
  { route: 'continue', icon: '📜', label: '어떤 모험가의 일지', desc: '기록된 여정을 이어서 진행합니다.' },
  { route: 'codex', icon: '📚', label: '대륙견문록', desc: '인물·지리·전승 문서를 열람합니다.' },
  { route: 'mods', icon: '⚙️', label: '신의 섭리', desc: '모드 및 확장 규칙을 조정합니다.' }
];
const overlay = document.querySelector('.overlay');
const eggButton = document.getElementById('easterEgg');
const testModeEntryButton = document.getElementById('testModeEntry');
const discardZone = document.getElementById('discardZone');
const rootStyle = document.documentElement.style;
let discardController = null;
let rerollController = null;
let isRerolling = false;

const applyAdminDebugMode = () => {
  // 관리자 디버그 모드 상태를 body 클래스로 노출해,
  // 이후 디버그 UI/기능을 CSS/JS에서 손쉽게 확장할 수 있게 한다.
  document.body.classList.toggle('admin-debug-mode', adminDebugMode);

  if (!testModeEntryButton) return;

  // 테스트 허브 버튼은 관리자 디버그 모드에서만 노출한다.
  testModeEntryButton.hidden = !adminDebugMode;
  testModeEntryButton.setAttribute('aria-hidden', String(!adminDebugMode));
};

const setAdminDebugMode = (enabled) => {
  adminDebugMode = Boolean(enabled);
  persistAdminDebugMode(adminDebugMode);
  applyAdminDebugMode();
};

// 디버그 중 콘솔에서 빠르게 제어할 수 있도록 최소 API를 노출한다.
// 예) NewtheriaDebug.setAdminDebugMode(false)
window.NewtheriaDebug = Object.assign({}, window.NewtheriaDebug, {
  getAdminDebugMode: () => adminDebugMode,
  setAdminDebugMode
});

const bootstrapPersistentStorage = () => {
  // 시작 화면에서 캐릭터/설정/세이브 메타 기본값을 1회 시드한다.
  // - 캐릭터 정보: localStorage
  // - 설정/세이브 슬롯 메타: localStorage
  // 로컬에는 대표 캐릭터만 유지한다. (대부분 캐릭터는 세이브 슬롯 데이터에 저장)
  const defaultCharacterCatalog = {
    goddess: {
      id: 'goddess',
      name: '아스테리아',
      layers: ['assets/img/goddess.png']
    },
    pilgrim: {
      id: 'pilgrim',
      name: '순례자',
      layers: ['assets/img/player.png']
    }
  };
  const defaultSettingsMeta = {
    language: 'ko-KR',
    textSpeed: 'normal',
    autoAdvance: false,
    updatedAt: new Date().toISOString()
  };
  const defaultSaveSlotsMeta = {
    updatedAt: new Date().toISOString(),
    activeSlotId: 'slot1',
    slots: [
      { id: 'slot1', label: '슬롯 1', hasData: false, updatedAt: '' },
      { id: 'slot2', label: '슬롯 2', hasData: false, updatedAt: '' },
      { id: 'slot3', label: '슬롯 3', hasData: false, updatedAt: '' }
    ]
  };
  const CHARACTER_POOLS_PATH = 'assets/data/character_common_pools.json';

  // 샘플 캐릭터 빌더
  // - 고정 규칙: ID 0=아스테리아, ID 1=플레이어(순례자)
  // - family가 없는 캐릭터는 familyId/family=null, surname=''를 사용한다.
  // - 가족 관계는 parent/spouse/affair/children id 참조로 저장한다.
  const buildSampleCharacters = () => ({
    pilgrim_pc: {
      id: 1,
      actorId: 'pilgrim_pc',
      uniqueSeed: '1000000001',
      role: 'pc',
      familyId: null,
      family: null,
      givenName: '순례자',
      surname: '',
      name: '순례자',
      gender: '미정',
      age: 24,
      heightCm: 175,
      weightKg: 68,
      race: '인간',
      familyLinks: {
        // 부모가 미확정일 때는 null
        fatherId: null,
        motherId: null,
        spouseId: null,
        affairPartnerIds: [],
        // 자식은 캐릭터 id 배열로 관리
        childrenIds: []
      },
      traits: {
        // 선천 특성은 공용 카탈로그 id를 참조한다. (용량 절감)
        innateTraitIds: [103, 106],
        // 후천 특성도 id를 참조한다. (acquiredTraitCatalog)
        acquiredTraitIds: [301, 306]
      },
      layers: ['assets/img/player.png'],
      stats: { STR: 9, DEX: 11, CON: 10, INT: 10, WIS: 12, CHA: 8 },
      alignment: {
        // -100 ~ 100: 양수는 왼쪽 성향, 음수는 오른쪽 성향
        aggressionVsModeration: -12,
        settlementVsWandering: -34,
        honorVsPragmatism: 28
      },
      // 캐릭터 개인 상태(경제/위치/인벤토리)
      wallet: {
        gold: 120,
        silver: 35,
        copper: 10
      },
      location: {
        regionId: 'sanctuary_outskirts',
        tile: { x: 12, y: 34, z: 0 },
        landmarkId: 'pilgrim_camp'
      },
      inventory: {
        maxSlots: 24,
        items: [
          { itemId: 'item_compass_old', qty: 1 },
          { itemId: 'item_ration_basic', qty: 3 }
        ]
      },
      // 숙원 참조는 중복 키를 줄이기 위해 aspiration 객체로 통합한다.
      aspiration: {
        currentId: null,
        poolId: 1
      }
    },
    asteria_npc: {
      id: 0,
      actorId: 'asteria_npc',
      uniqueSeed: '1000000000',
      role: 'npc',
      familyId: null,
      family: null,
      givenName: '아스테리아',
      surname: '',
      name: '아스테리아',
      gender: '여성형 신격',
      age: 312,
      heightCm: 178,
      weightKg: 0,
      race: '신성체',
      familyLinks: {
        fatherId: null,
        motherId: null,
        spouseId: null,
        affairPartnerIds: [],
        childrenIds: []
      },
      traits: {
        innateTraitIds: [101, 104],
        acquiredTraitIds: [308, 302]
      },
      layers: ['assets/img/goddess.png'],
      stats: { STR: 8, DEX: 10, CON: 12, INT: 14, WIS: 16, CHA: 15 },
      alignment: {
        aggressionVsModeration: -48,
        settlementVsWandering: 40,
        honorVsPragmatism: 18
      },
      // 캐릭터 개인 상태(경제/위치/인벤토리)
      wallet: {
        gold: 980,
        silver: 420,
        copper: 0
      },
      location: {
        regionId: 'sanctuary_core',
        tile: { x: 88, y: 12, z: 0 },
        landmarkId: 'astral_hall'
      },
      inventory: {
        maxSlots: 40,
        items: [
          { itemId: 'item_astral_seal', qty: 2 },
          { itemId: 'item_star_shard', qty: 5 }
        ]
      },
      // 숙원 참조는 중복 키를 줄이기 위해 aspiration 객체로 통합한다.
      aspiration: {
        currentId: null,
        poolId: 1
      }
    }
  });

  // 슬롯 시드 데이터 빌더
  // - 대용량 공용 풀(선천 특성/숙원 후보)은 세이브에 중복 저장하지 않는다.
  // - 공용 정책(selectionPolicy/behaviorProfile)은 외부 파일에서 로드한다.
  // - 저장 용량 절감을 위해 trait/aspiration은 문자열 대신 id 참조를 우선 사용한다.
  const buildDefaultSaveSlotsData = () => ({
    // 세이브 스키마 버전: 구조 변경 시 마이그레이션 기준으로 사용한다.
    saveSchemaVersion: '1.0.0',
    activeSlotId: 'slot1',
    slots: {
      slot1: {
        catalogRefs: { characterPools: CHARACTER_POOLS_PATH },
        characters: buildSampleCharacters(),
        flags: {},
        dialogueProgress: null
      },
      slot2: { characters: {}, flags: {}, dialogueProgress: null },
      slot3: { characters: {}, flags: {}, dialogueProgress: null }
    }
  });

  const defaultSaveSlotsData = buildDefaultSaveSlotsData();

  const poolsCache = {
    data: null,
    indexes: null
  };

  // 공용 풀(JSON) 로드 후 인덱스를 만들어 런타임 조회 비용을 줄인다.
  const preloadCharacterPools = async () => {
    const utils = globalThis.NewtheriaCharacterDataUtils;
    if (!utils?.buildCharacterIndexes) return;

    try {
      const response = await fetch(CHARACTER_POOLS_PATH, { cache: 'no-store' });
      if (!response.ok) throw new Error(`character pools fetch failed: ${response.status}`);
      const pools = await response.json();
      poolsCache.data = pools;
      poolsCache.indexes = utils.buildCharacterIndexes({ pools });
    } catch (error) {
      console.warn('캐릭터 공용 풀 프리로드에 실패했습니다.', error);
    }
  };

  const seedIfMissing = (key, value) => {
    if (!window.localStorage) return;
    if (window.localStorage.getItem(key) != null) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  };

  try {
    // 샘플 캐릭터 데이터 무결성 검증 (id 중복/참조 누락 방지)
    const utils = globalThis.NewtheriaCharacterDataUtils;
    if (utils?.validateCharacterData) {
      const result = utils.validateCharacterData({
        characters: defaultSaveSlotsData?.slots?.slot1?.characters || {}
      });
      if (!result.ok) {
        console.warn('샘플 캐릭터 데이터 검증 오류:', result.errors);
      }
    }

    seedIfMissing(STORAGE_KEYS.characterCatalog, defaultCharacterCatalog);
    seedIfMissing(STORAGE_KEYS.settingsMeta, defaultSettingsMeta);
    seedIfMissing(STORAGE_KEYS.saveSlotsMeta, defaultSaveSlotsMeta);
    seedIfMissing(STORAGE_KEYS.saveSlotsData, defaultSaveSlotsData);
  } catch (error) {
    console.warn('시작 화면 스토리지 초기화에 실패했습니다.', error);
  }

  // 인덱스는 비동기로 준비한다. (UI 초기화 블로킹 방지)
  void preloadCharacterPools();
};

const UI = {
  cardVerticalStep: 14,
  rerollOverlayMs: 620,
  dragThresholdPx: 5,
  longPressMs: 440,
  longPressMoveTolerancePx: 8,
  discardRevealDistancePx: 0,
  hoverPushMax: 44,
  hoverLiftY: -14,
  hoverScale: 1.03,
  hoverDistanceRatioNear: 0.56,
  hoverDistanceRatioFar: 0.28,
  reroll: {
    flipToBackMs: 280,
    collectMs: 360,
    spinMs: 1080,
    spreadBaseMs: 420,
    spreadStepMs: 40,
    flipToFrontMs: 200,
    settleMs: 420
  },
  stack: {
    txMin: 4,
    txRange: 20,
    tyRange: 18,
    tyCenterOffset: 9,
    rotRange: 6,
    rotCenterOffset: 3,
    spinTurnsDeg: 360,
    spinCycles: 3
  }
};

const randomBetween = (min, max) => Math.random() * (max - min) + min;

let cardFanBehavior = null;
let staticEventsBound = false;
const MOBILE_BREAKPOINT = 760;

const applyResponsiveUiTuning = () => {
  isMobileViewport = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
  UI.cardVerticalStep = isMobileViewport ? 10 : 14;
  UI.dragThresholdPx = isMobileViewport ? 9 : 5;
  UI.longPressMs = isMobileViewport ? 360 : 440;
  UI.longPressMoveTolerancePx = isMobileViewport ? 12 : 8;
  UI.discardRevealDistancePx = isMobileViewport ? 110 : 150;
  UI.hoverPushMax = isMobileViewport ? 18 : 44;
  UI.hoverLiftY = isMobileViewport ? -8 : -14;
  UI.hoverScale = isMobileViewport ? 1.01 : 1.03;
  UI.hoverDistanceRatioNear = isMobileViewport ? 0.44 : 0.56;
  UI.hoverDistanceRatioFar = isMobileViewport ? 0.22 : 0.28;
};

const initializeCards = () => {
  const cardTemplateApi = window.NewtheriaCardTemplates;
  if (cardTemplateApi?.renderCardFanCards) {
    cards = cardTemplateApi.renderCardFanCards(menu, CARD_MENU_ITEMS);
  } else {
    cards = [...menu.querySelectorAll('.card-fan-card')];
  }

  cardFanBehavior = cardTemplateApi?.createCardFanBehavior
    ? cardTemplateApi.createCardFanBehavior({
      menu,
      cards,
      ui: {
        cardVerticalStep: UI.cardVerticalStep,
        dragThresholdPx: UI.dragThresholdPx,
        longPressMs: UI.longPressMs,
        longPressMoveTolerancePx: UI.longPressMoveTolerancePx,
        hoverPushMax: UI.hoverPushMax,
        hoverLiftY: UI.hoverLiftY,
        hoverScale: UI.hoverScale,
        hoverDistanceRatioNear: UI.hoverDistanceRatioNear,
        hoverDistanceRatioFar: UI.hoverDistanceRatioFar,
        settleMs: UI.reroll.settleMs
      }
    })
    : null;
};

const layout = {
  applyCardTransforms(hoveredCard = null) {
    if (cardFanBehavior?.applyCardTransforms) {
      cardFanBehavior.applyCardTransforms(hoveredCard);
    }
  },

  layoutCards() {
    if (cardFanBehavior?.layoutCards) {
      cardFanBehavior.layoutCards();
    }
  },

  shuffleCardOrder() {
    if (cardFanBehavior?.shuffleCardOrder) {
      cardFanBehavior.shuffleCardOrder();
      cards = cardFanBehavior.getCards();
    }
  }
};

const effects = {
  twinkleLayer: document.querySelector('.twinkle'),

  createStarLayer({ count, minRadius, maxRadius, alphaMin, alphaMax, palette }) {
    const gradients = [];

    for (let i = 0; i < count; i += 1) {
      const x = randomBetween(0, 100).toFixed(2);
      const y = randomBetween(0, 100).toFixed(2);
      const radius = randomBetween(minRadius, maxRadius);
      const fadeRadius = radius + randomBetween(0.9, 1.8);
      const alpha = randomBetween(alphaMin, alphaMax).toFixed(2);
      const color = palette[Math.floor(Math.random() * palette.length)];
      gradients.push(`radial-gradient(circle at ${x}% ${y}%, rgba(${color}, ${alpha}) 0 ${radius.toFixed(2)}px, transparent ${fadeRadius.toFixed(2)}px)`);
    }

    return gradients.join(', ');
  },

  applyStarField() {
    rootStyle.setProperty('--stars-a', this.createStarLayer({
      count: 220,
      minRadius: 0.24,
      maxRadius: 0.88,
      alphaMin: 0.35,
      alphaMax: 0.82,
      palette: ['233, 242, 255', '214, 229, 255', '190, 214, 255']
    }));

    rootStyle.setProperty('--stars-b', this.createStarLayer({
      count: 120,
      minRadius: 0.38,
      maxRadius: 1.24,
      alphaMin: 0.32,
      alphaMax: 0.78,
      palette: ['178, 205, 255', '154, 187, 255', '133, 168, 245']
    }));

    rootStyle.setProperty('--stars-c', this.createStarLayer({
      count: 24,
      minRadius: 0.8,
      maxRadius: 1.9,
      alphaMin: 0.34,
      alphaMax: 0.72,
      palette: ['122, 238, 255', '107, 224, 255', '184, 208, 255']
    }));
    this.applyTwinkleStars();
  },

  applyTwinkleStars() {
    if (!this.twinkleLayer) return;

    this.twinkleLayer.replaceChildren();
    const fragment = document.createDocumentFragment();
    const twinkleCount = 84;
    const twinkleColors = [
      '255, 255, 255',
      '232, 242, 255',
      '184, 208, 255',
      '138, 242, 255'
    ];

    for (let i = 0; i < twinkleCount; i += 1) {
      const star = document.createElement('span');
      star.className = 'twinkle-star';
      star.style.setProperty('--twinkle-x', `${randomBetween(0, 100).toFixed(2)}%`);
      star.style.setProperty('--twinkle-y', `${randomBetween(0, 100).toFixed(2)}%`);
      star.style.setProperty('--twinkle-size', `${randomBetween(1.1, 3).toFixed(2)}px`);
      star.style.setProperty('--twinkle-max', randomBetween(0.45, 0.96).toFixed(2));
      star.style.setProperty('--twinkle-duration', `${randomBetween(2.2, 8.8).toFixed(2)}s`);
      star.style.setProperty('--twinkle-delay', `${randomBetween(-8.8, 0).toFixed(2)}s`);
      star.style.setProperty('--twinkle-color', twinkleColors[Math.floor(Math.random() * twinkleColors.length)]);
      fragment.appendChild(star);
    }

    this.twinkleLayer.appendChild(fragment);
  }
};

const performanceMode = {
  shouldReduceMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  detectLowSpec() {
    const cpuCores = navigator.hardwareConcurrency ?? 8;
    const deviceMemory = navigator.deviceMemory ?? 8;
    return cpuCores <= 4 || deviceMemory <= 4;
  },

  shouldDisableStarAnimation() {
    return this.shouldReduceMotion() || this.detectLowSpec();
  },

  applyStarAnimationMode() {
    const disableStarAnimation = this.shouldDisableStarAnimation();
    document.body.classList.toggle('reduced-effects', disableStarAnimation);
    if (!disableStarAnimation) {
      effects.applyStarField();
    }
  }
};

const reroll = {
  async play() {
    if (!rerollController) return;
    await rerollController.play();
  }
};

const restoreCardsForStartScreen = () => {
  menu.classList.remove('selecting');
  initializeCards();
  bindCardInteractions();
  layout.layoutCards();
};

const bindCardInteractions = () => {
  const cardTemplateApi = window.NewtheriaCardTemplates;
  discardController = cardTemplateApi?.createDiscardZoneController
    ? cardTemplateApi.createDiscardZoneController({
      zone: discardZone,
      revealDistancePx: UI.discardRevealDistancePx
    })
    : null;

  cardFanBehavior?.bindInteractions({
    isLocked: () => isRerolling,
    shouldDiscardDrop: ({ event }) => discardController?.shouldDiscardDrop({ event }) || false,
    onDragStateChange: (isDragging) => {
      discardController?.onDragStateChange(isDragging);
      if (isDragging && isMobileViewport) {
        layout.applyCardTransforms();
      }
    },
    onDragMove: ({ event, moved }) => {
      discardController?.onDragMove({ event, moved });
    },
    onCardDiscarded: (_, renderedCards) => {
      discardController?.reset();
      if (renderedCards.length === 0) {
        restoreCardsForStartScreen();
      }
    },
    onCardSelected: (card, renderedCards) => {
      if (cardTemplateApi?.setActiveCard) {
        cardTemplateApi.setActiveCard(renderedCards, card);
      } else {
        renderedCards.forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
      }
      if (isMobileViewport) {
        layout.applyCardTransforms(card);
      }
    }
  });
};

const bindStaticEvents = () => {
  if (staticEventsBound) return;
  staticEventsBound = true;

  eggButton.addEventListener('click', () => reroll.play());
  // 테스트 허브로 이동: 신규 기능은 우선 Test Mode에서 검증 후 메인 흐름에 반영한다.
  testModeEntryButton?.addEventListener('click', () => {
    window.location.href = './test_mode.html';
  });
  window.addEventListener('resize', () => {
    applyResponsiveUiTuning();
    discardController?.cacheRect();
    layout.layoutCards();
  });
  window.addEventListener('scroll', () => discardController?.cacheRect(), { passive: true });
  document.addEventListener('pointerdown', (e) => {
    if (!isMobileViewport) return;
    if (e.target.closest('.card-fan-card')) return;
    cards.forEach((card) => card.classList.remove('active'));
    layout.applyCardTransforms();
  });
};

const updateStartVersionTag = async () => {
  // 시작 화면 버전 정보는 하드코딩 대신 변경이력 최신 헤더를 기준으로 동기화한다.
  if (!eggButton) return;
  let version = START_VERSION_FALLBACK;

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
    console.warn('시작 화면 버전 정보를 변경 이력에서 불러오지 못했습니다.', error);
  }

  eggButton.textContent = version;
};

const bootstrap = () => {
  const cardTemplateApi = window.NewtheriaCardTemplates;
  bootstrapPersistentStorage();
  applyResponsiveUiTuning();
  initializeCards();
  bindCardInteractions();
  rerollController = cardTemplateApi?.createCardFanReroll
    ? cardTemplateApi.createCardFanReroll({
      menu,
      getCards: () => cards,
      layout,
      timing: UI.reroll,
      stack: UI.stack,
      isLocked: () => isRerolling,
      setLocked: (locked) => {
        isRerolling = locked;
        menu.classList.toggle('rerolling', locked);
      },
      beforePlay: (renderedCards) => {
        menu.classList.remove('selecting');
        layout.applyCardTransforms();
        if (cardTemplateApi?.setActiveCard) {
          cardTemplateApi.setActiveCard(renderedCards);
        } else {
          renderedCards.forEach((card) => card.classList.remove('active'));
        }
      }
    })
    : null;
  bindStaticEvents();
  applyAdminDebugMode();
  performanceMode.applyStarAnimationMode();
  updateStartVersionTag();
  layout.layoutCards();
};

bootstrap();
