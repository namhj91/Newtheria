const STORAGE_KEYS = {
  saveSlotsData: 'newtheria.saveSlots.data'
};

// NPC/PC 템플릿 문서를 기준으로, NPC 테스트용 기본 JSON을 준비한다.
const DEFAULT_NPC_TEMPLATE = {
  id: 2,
  actorId: 'test_blacksmith_npc',
  uniqueSeed: '1000000002',
  role: 'npc',
  family: '102가문',
  givenName: '레오나',
  surname: '하이스',
  name: '레오나 하이스',
  gender: '여성',
  age: 31,
  heightCm: 169,
  weightKg: 59,
  race: '인간',
  raceInheritanceRule: '부모 종족 계승',
  familyLinks: {
    fatherId: null,
    motherId: null,
    childrenIds: []
  },
  traits: {
    innateTraitIds: [103],
    acquired: ['금속 제련', '야전 수리']
  },
  layers: ['assets/img/goddess.png'],
  stats: { STR: 12, DEX: 10, CON: 11, INT: 10, WIS: 9, CHA: 8 },
  alignment: {
    aggressionVsModeration: -5,
    settlementVsWandering: 36,
    honorVsPragmatism: 11
  },
  wallet: {
    gold: 35,
    silver: 12,
    copper: 8
  },
  location: {
    regionId: 'forge_district',
    tile: { x: 17, y: 42, z: 0 },
    landmarkId: 'eastern_forge'
  },
  inventory: {
    maxSlots: 20,
    items: [
      { itemId: 'item_hammer_reinforced', qty: 1 },
      { itemId: 'item_iron_ingot', qty: 6 }
    ]
  },
  aspiration: {
    currentId: null,
    poolId: 1
  }
};

const npcJsonInput = document.getElementById('npcJsonInput');
const npcStatus = document.getElementById('npcStatus');
const npcName = document.getElementById('npcName');
const npcMeta = document.getElementById('npcMeta');
const npcCoreInfo = document.getElementById('npcCoreInfo');
const npcStats = document.getElementById('npcStats');
const npcTraits = document.getElementById('npcTraits');
const npcInventory = document.getElementById('npcInventory');

const setStatus = (message, isError = false) => {
  npcStatus.textContent = message;
  npcStatus.style.color = isError ? '#ff8d8d' : '#d7e4ff';
};

const stringifyNpc = (npc) => JSON.stringify(npc, null, 2);

const fillNpcCoreInfo = (npc) => {
  const infoItems = [
    ['ID', npc.id],
    ['고유 시드', npc.uniqueSeed],
    ['가문', npc.family || '무가문'],
    ['나이', npc.age],
    ['신장/체중', `${npc.heightCm}cm / ${npc.weightKg}kg`],
    ['위치', npc.location?.regionId || '-']
  ];

  npcCoreInfo.replaceChildren(...infoItems.map(([label, value]) => {
    const li = document.createElement('li');
    li.textContent = `${label}: ${value}`;
    return li;
  }));
};

const fillNpcStats = (npc) => {
  const entries = Object.entries(npc.stats || {});
  npcStats.replaceChildren(...entries.map(([key, value]) => {
    const li = document.createElement('li');
    li.textContent = `${key}: ${value}`;
    return li;
  }));
};

const renderNpc = (npc) => {
  npcName.textContent = npc.name || `${npc.givenName || ''} ${npc.surname || ''}`.trim() || '이름 없음';
  npcMeta.textContent = `${npc.role || 'unknown'} · ${npc.race || '종족 미정'} · ${npc.gender || '성별 미정'}`;

  fillNpcCoreInfo(npc);
  fillNpcStats(npc);

  const innateTraits = Array.isArray(npc.traits?.innateTraitIds) ? npc.traits.innateTraitIds.join(', ') : '-';
  const acquiredTraits = Array.isArray(npc.traits?.acquired) ? npc.traits.acquired.join(', ') : '-';
  npcTraits.textContent = `선천 특성 ID: ${innateTraits} / 후천 특성: ${acquiredTraits}`;

  const inventoryItems = Array.isArray(npc.inventory?.items)
    ? npc.inventory.items.map((item) => `${item.itemId} x${item.qty}`).join(', ')
    : '-';
  npcInventory.textContent = `슬롯 ${npc.inventory?.maxSlots || 0}칸 · ${inventoryItems}`;
};

const parseNpcInput = () => {
  const parsed = JSON.parse(npcJsonInput.value);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('NPC JSON은 객체여야 합니다.');
  }
  return parsed;
};

const loadNpcFromSlot = () => {
  const raw = window.localStorage?.getItem(STORAGE_KEYS.saveSlotsData);
  if (!raw) {
    throw new Error('세이브 슬롯 데이터가 없습니다. 시작 화면을 먼저 열어 시드를 생성하세요.');
  }

  const saveBlob = JSON.parse(raw);
  const characters = saveBlob?.slots?.slot1?.characters || {};

  // role이 npc인 첫 캐릭터를 선택해 테스트 패널로 가져온다.
  const npc = Object.values(characters).find((character) => character?.role === 'npc');
  if (!npc) {
    throw new Error('slot1에서 NPC 데이터를 찾지 못했습니다.');
  }

  npcJsonInput.value = stringifyNpc(npc);
  renderNpc(npc);
  setStatus('slot1 NPC를 불러와 렌더링했습니다.');
};

const restoreDefaultTemplate = () => {
  npcJsonInput.value = stringifyNpc(DEFAULT_NPC_TEMPLATE);
  renderNpc(DEFAULT_NPC_TEMPLATE);
  setStatus('기본 템플릿으로 복원했습니다.');
};

const bindEvents = () => {
  document.getElementById('loadNpcFromSlot').addEventListener('click', () => {
    try {
      loadNpcFromSlot();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'NPC 로드에 실패했습니다.', true);
    }
  });

  document.getElementById('resetNpcTemplate').addEventListener('click', () => {
    restoreDefaultTemplate();
  });

  document.getElementById('renderNpc').addEventListener('click', () => {
    try {
      const npc = parseNpcInput();
      renderNpc(npc);
      setStatus('NPC JSON을 반영했습니다.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'JSON 파싱에 실패했습니다.', true);
    }
  });
};

restoreDefaultTemplate();
bindEvents();
