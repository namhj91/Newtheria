const NPC_COUNT = 300;
const NAME_POOL_PATH = './assets/data/npc_name_pools.json';
const ADULT_AGE = 18;
const SPOUSE_MAX_AGE_GAP = 24;
const SPOUSE_MATCH_CHANCE = 0.58;
const AFFAIR_TRIGGER_CHANCE = 0.08;
const AFFAIR_MULTI_CHANCE = 0.22;
const MAX_AFFAIRS_DEFAULT = 1;

// 숫자 id 하드코딩을 줄이기 위한 특성 상수.
const TRAIT_ID = {
  CASANOVA: 311,
  FEMME_FATALE: 312,
  INCEST_INCLINATION: 313,
  ANYTHING_GOES: 314
};

// 시드 기반 속궁합 계산 설정:
// - payload 9자리(3자리 x,y,z) + checksum 1자리
// - 토러스 거리 기반 점수 분포를 평균 50 근처로 맞추기 위해 p=1.2 사용
const SEED_COMPATIBILITY = {
  axisSize: 1000,
  axisMid: 500,
  scorePower: 1.2
};

const RACE_POOL = [
  { name: '인간', key: 'human', adultAge: 18, elderAge: 60, maxAge: 85 },
  { name: '엘프', key: 'elf', adultAge: 30, elderAge: 180, maxAge: 320 },
  { name: '드워프', key: 'dwarf', adultAge: 24, elderAge: 120, maxAge: 210 },
  { name: '용인', key: 'dragonborn', adultAge: 22, elderAge: 140, maxAge: 240 }
];

// 가문 규칙:
// - 기본적으로 개인 성씨를 기준으로 가문 id/이름을 만든다.
// - 예외적으로 여성은 결혼 시 배우자(남성)의 가문으로 편입된다.
const FAMILY_NAME_BY_ID = new Map();
const TRAIT_CATALOG = [
  { id: 301, name: '전술 감각', type: '정신', rarity: '일반', description: '전황 판단과 지휘 효율을 높인다.' },
  { id: 302, name: '사교성', type: '정신', rarity: '일반', description: '대화와 호감도 형성에 유리하다.' },
  { id: 303, name: '야간 시야', type: '신체', rarity: '희귀', description: '야간 이동/탐색 시 시야 페널티를 완화한다.' },
  { id: 304, name: '수렵 본능', type: '신체', rarity: '일반', description: '추적과 사냥 효율을 높인다.' },
  { id: 305, name: '기계 수리', type: '기타', rarity: '일반', description: '장치/설비 수리 성공률을 높인다.' },
  { id: 306, name: '약초 지식', type: '정신', rarity: '일반', description: '약초 식별 및 조합 효율을 높인다.' },
  { id: 307, name: '재봉 기술', type: '기타', rarity: '일반', description: '의복/천 장비 제작과 수선에 능하다.' },
  { id: 308, name: '연설 능력', type: '정신', rarity: '희귀', description: '다수 설득과 사기 고양에 보너스를 준다.' },
  { id: 309, name: '화염 저항', type: '신체', rarity: '희귀', description: '화염 피해 저항과 내열 적응력을 높인다.' },
  { id: 310, name: '지형 파악', type: '기타', rarity: '일반', description: '지형 기반 이동/매복 판단을 강화한다.' },
  { id: 311, name: '카사노바', type: '기타', rarity: '영웅', description: '연문 관계 인원 제한을 적용받지 않는다. (남성 전용 예외)' },
  { id: 312, name: '팜므파탈', type: '기타', rarity: '영웅', description: '연문 관계 인원 제한을 적용받지 않는다. (여성 전용 예외)' },
  // 혼인 예외를 여는 성향 특성은 페티시 분류로 묶어서 관리한다.
  { id: 313, name: '근친 성향', type: '페티시', rarity: '전설', description: '형제(이복 포함) 간 혼인 제한을 무시한다.' },
  { id: 314, name: '가능충', type: '페티시', rarity: '전설', description: '이종 간 혼인 제한을 무시한다. (단, 이종 배우자끼리는 자녀 불가)' }
];
const TRAIT_BY_ID = new Map(TRAIT_CATALOG.map((trait) => [trait.id, trait]));
// 특성의 기능(description)과 별도로, 분위기/평판을 빠르게 읽는 메타 한줄평 데이터.
const TRAIT_META_REVIEW_BY_ID = new Map([
  [301, '판을 읽는 지휘형 인재'],
  [302, '어디서든 분위기를 푸는 친화형'],
  [303, '밤 전장에서 빛나는 정찰형'],
  [304, '감각으로 먹고사는 야생형'],
  [305, '고장 나면 가장 먼저 찾는 해결사'],
  [306, '약초창고의 살아있는 도감'],
  [307, '소모품을 자산으로 바꾸는 생활형'],
  [308, '말 한마디로 전황을 바꾸는 선동형'],
  [309, '불길 속에서도 버티는 내열형'],
  [310, '지도를 머릿속에 넣고 다니는 탐지형'],
  [311, '관계 확장을 멈추지 않는 연애 과열형'],
  [312, '치명적 매력으로 관계를 설계하는 유혹형'],
  [313, '금기선마저 넘는 집착형 페티시'],
  [314, '종족 경계도 무시하는 초개방형 페티시']
]);
const STAT_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

const generateButton = document.getElementById('generateNpcList');
const sortByAgeButton = document.getElementById('sortByAge');
const sortByNameButton = document.getElementById('sortByName');
const openCompareDialogButton = document.getElementById('openCompareDialog');
const npcListElement = document.getElementById('npcList');
const npcSummaryElement = document.getElementById('npcSummary');
const npcDetailDialog = document.getElementById('npcDetailDialog');
const dialogNpcName = document.getElementById('dialogNpcName');
const dialogNpcMeta = document.getElementById('dialogNpcMeta');
const dialogNpcDetail = document.getElementById('dialogNpcDetail');
const radarChart = document.getElementById('npcRadarChart');
const npcContextList = document.getElementById('npcContextList');
const tabButtons = Array.from(document.querySelectorAll('.npc-tab'));
const tabPanels = Array.from(document.querySelectorAll('.npc-tabpanel'));
const comparePreviewPair = document.getElementById('comparePreviewPair');
const comparePreviewBar = document.getElementById('comparePreviewBar');
const comparePreviewScore = document.getElementById('comparePreviewScore');
const npcCompareDialog = document.getElementById('npcCompareDialog');
const compareNpcASelect = document.getElementById('compareNpcA');
const compareNpcBSelect = document.getElementById('compareNpcB');
const compareDialogBar = document.getElementById('compareDialogBar');
const compareDialogScore = document.getElementById('compareDialogScore');
const compareDialogMeta = document.getElementById('compareDialogMeta');
const traitDetailDialog = document.getElementById('traitDetailDialog');
const traitDialogTitle = document.getElementById('traitDialogTitle');
const traitDialogBody = document.getElementById('traitDialogBody');
const npcActionDeck = document.getElementById('npcActionDeck');
const familyTreeDialog = document.getElementById('familyTreeDialog');
const familyTreeTitle = document.getElementById('familyTreeTitle');
const familyTreeRoot = document.getElementById('familyTreeRoot');
const detailTabs = Array.from(document.querySelectorAll('.dialog-tab'));

// 외부 파일을 못 읽는 환경을 대비한 최소 fallback 데이터.
const DEFAULT_NAME_POOLS = {
  human: {
    male: ['리처드', '윌리엄', '에드워드', '토마스', '로버트'],
    female: ['메리', '제인', '엘리자베스', '아멜리아', '캐서린'],
    surnames: ['스미스', '윈저', '랭커스터', '튜더', '브루스']
  },
  elf: {
    male: ['파엔다르', '엘라리안', '실리온', '갈라디르', '레놀라스'],
    female: ['아라엘', '리리엔', '니무에', '베스퍼', '티란디아'],
    surnames: ['윈드러너', '실버리프', '스타폴', '문위스퍼', '선스트라이더']
  },
  dwarf: {
    male: ['소림', '코르바도르', '바인', '그롬나르', '타르간'],
    female: ['헬가', '다이나', '브룬힐다', '디스', '모이라'],
    surnames: ['스톤해머', '아이언포지', '브론즈비어드', '락크러셔', '실버베인']
  },
  dragonborn: {
    male: ['드라가르', '록사르', '발라사', '아르잔', '토린바르'],
    female: ['크리나', '파리데', '소라', '젤렌', '다라'],
    surnames: ['아이언스케일', '플레임텅', '블러드혼', '레드팽', '드래곤베인']
  }
};

let npcList = [];
let namePools = DEFAULT_NAME_POOLS;
let compareSelection = { leftId: null, rightId: null };
let activeDetailTab = 'overview';
let actionDeckBehavior = null;
let npcIndexes = {
  byId: new Map(),
  byRace: new Map(),
  byFamily: new Map(),
  byAffair: new Map(),
  byTrait: new Map()
};

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickOne = (pool) => pool[randomInt(0, pool.length - 1)];
const traitNameOf = (traitId) => TRAIT_BY_ID.get(traitId)?.name || `미정특성#${traitId}`;
const traitMetaReviewOf = (traitId) => TRAIT_META_REVIEW_BY_ID.get(traitId) || '특성 메타 한줄평 미정';
const isAdult = (npc) => (npc?.age || 0) >= ADULT_AGE;

const computeSeedChecksum = (payload) => (
  payload
    .split('')
    .reduce((acc, digit) => acc + Number(digit), 0) % 10
);

const attachSeedChecksum = (payload) => `${payload}${computeSeedChecksum(payload)}`;
const isSeedChecksumValid = (seed) => {
  if (!/^\d{10}$/.test(String(seed || ''))) return false;
  const payload = String(seed).slice(0, 9);
  const checksum = Number(String(seed).slice(9));
  return computeSeedChecksum(payload) === checksum;
};

const createUniqueSeedGenerator = () => {
  const usedSeeds = new Set();

  return () => {
    // 9자리 payload를 만들고 마지막 1자리를 checksum으로 붙여 10자리 시드를 생성한다.
    while (true) {
      const payload = String(randomInt(100_000_000, 999_999_999));
      const seed = attachSeedChecksum(payload);
      if (!usedSeeds.has(seed)) {
        usedSeeds.add(seed);
        return seed;
      }
    }
  };
};

const createAgeForRace = (raceInfo) => {
  // 종족 수명대를 고려해 청년/장년/노년 분포를 적당히 섞는다.
  const dice = Math.random();
  if (dice < 0.14) return randomInt(0, raceInfo.adultAge - 1);
  if (dice < 0.82) return randomInt(raceInfo.adultAge, raceInfo.elderAge - 1);
  return randomInt(raceInfo.elderAge, raceInfo.maxAge);
};

const createStats = () => ({
  // 시각화하기 좋도록 6~20 구간으로 생성한다.
  STR: randomInt(6, 20),
  DEX: randomInt(6, 20),
  CON: randomInt(6, 20),
  INT: randomInt(6, 20),
  WIS: randomInt(6, 20),
  CHA: randomInt(6, 20)
});

const seedToTorusPoint = (seed) => {
  const digits = String(seed || '').replace(/\D/g, '');
  // 체크섬이 맞지 않더라도 payload 9자리는 최대한 활용해 좌표를 복원한다.
  const payload = digits.slice(0, 9).padEnd(9, '0');
  return [
    Number(payload.slice(0, 3)),
    Number(payload.slice(3, 6)),
    Number(payload.slice(6, 9))
  ];
};

const torusAxisDistance = (a, b, size) => {
  const raw = Math.abs(a - b);
  return Math.min(raw, size - raw);
};

const calculateSeedCompatibilityPercent = (left, right) => {
  if (!left || !right) return null;
  const leftPoint = seedToTorusPoint(left.uniqueSeed);
  const rightPoint = seedToTorusPoint(right.uniqueSeed);
  const size = SEED_COMPATIBILITY.axisSize;
  const axisDistances = leftPoint.map((coord, index) => torusAxisDistance(coord, rightPoint[index], size));
  const distance = Math.hypot(...axisDistances);
  const maxDistance = Math.sqrt(3 * (SEED_COMPATIBILITY.axisMid ** 2));
  const normalized = Math.min(distance / maxDistance, 1);
  const score = 100 * (1 - (normalized ** SEED_COMPATIBILITY.scorePower));
  return Math.round(Math.max(0, Math.min(100, score)));
};

const pickRaceNameParts = (raceInfo, gender) => {
  const raceNames = namePools[raceInfo.key] || DEFAULT_NAME_POOLS[raceInfo.key];
  const givenPool = gender === '남성' ? raceNames.male : raceNames.female;

  return {
    surname: pickOne(raceNames.surnames),
    givenName: pickOne(givenPool)
  };
};

const normalizeFamilyIdToken = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '_')
  .replace(/[^a-z0-9가-힣_]/g, '');

const ensureFamilyBySurname = (surname = '') => {
  const safeSurname = String(surname || '').trim() || '무명';
  const familyId = `house_${normalizeFamilyIdToken(safeSurname) || 'unknown'}`;
  if (!FAMILY_NAME_BY_ID.has(familyId)) {
    FAMILY_NAME_BY_ID.set(familyId, `${safeSurname}가문`);
  }
  return familyId;
};

// NPC 데이터는 familyId를 저장하고, UI에서는 표시 이름으로 변환해 보여준다.
const getFamilyName = (npc) => FAMILY_NAME_BY_ID.get(npc?.familyId) || npc?.familyId || '무가문';

const createNpcBase = (id, createSeed) => {
  const raceInfo = pickOne(RACE_POOL);
  const gender = Math.random() < 0.5 ? '남성' : '여성';
  const nameParts = pickRaceNameParts(raceInfo, gender);
  const age = createAgeForRace(raceInfo);

  return {
    id,
    actorId: `random_npc_${String(id).padStart(3, '0')}`,
    uniqueSeed: createSeed(),
    role: 'npc',
    // 기본 규칙: 개인 성씨 기반 가문 소속
    familyId: ensureFamilyBySurname(nameParts.surname),
    // 이름을 객체화해서 필요한 곳에서 성/이름/전체 이름을 각각 활용할 수 있도록 저장한다.
    name: {
      surname: nameParts.surname,
      given: nameParts.givenName,
      full: `${nameParts.surname} ${nameParts.givenName}`
    },
    gender,
    age,
    race: raceInfo.name,
    stats: createStats(),
    familyLinks: {
      fatherId: null,
      motherId: null,
      spouseId: null,
      affairPartnerIds: [],
      childrenIds: []
    },
    traits: {
      acquiredTraitIds: [pickOne(TRAIT_CATALOG).id, pickOne(TRAIT_CATALOG).id]
    }
  };
};

const canBeParent = (npc, child, minParentAgeGap) => npc.race === child.race && npc.age - child.age >= minParentAgeGap;
const hasAcquiredTrait = (npc, traitId) => (npc?.traits?.acquiredTraitIds || []).includes(traitId);

// 형제(이복 포함) 여부 판정:
// - 아버지 또는 어머니 id가 하나라도 같으면 형제로 본다.
const areSiblings = (left, right) => {
  if (!left || !right) return false;
  const leftLinks = left.familyLinks || {};
  const rightLinks = right.familyLinks || {};
  const shareFather = Boolean(leftLinks.fatherId && leftLinks.fatherId === rightLinks.fatherId);
  const shareMother = Boolean(leftLinks.motherId && leftLinks.motherId === rightLinks.motherId);
  return shareFather || shareMother;
};

const canBypassSiblingMarriageRestriction = (left, right) => (
  hasAcquiredTrait(left, TRAIT_ID.INCEST_INCLINATION) || hasAcquiredTrait(right, TRAIT_ID.INCEST_INCLINATION)
);
const canBypassInterRaceMarriageRestriction = (left, right) => (
  hasAcquiredTrait(left, TRAIT_ID.ANYTHING_GOES) || hasAcquiredTrait(right, TRAIT_ID.ANYTHING_GOES)
);

const canBeSpousePair = (left, right) => {
  // 성인/서로 미혼/적당한 나이 차를 기본으로 하고, 일부 제약은 특성으로 예외 허용한다.
  if (!left || !right || left.id === right.id) return false;
  // 이종 혼인은 기본 금지지만, '가능충' 특성이 있으면 허용한다.
  if (left.race !== right.race && !canBypassInterRaceMarriageRestriction(left, right)) return false;
  if (left.gender === right.gender) return false;
  if (!isAdult(left) || !isAdult(right)) return false;
  if (left.familyLinks.spouseId || right.familyLinks.spouseId) return false;
  // 형제(이복 포함) 혼인은 기본 금지지만, '근친 성향' 특성이 있으면 허용한다.
  if (areSiblings(left, right) && !canBypassSiblingMarriageRestriction(left, right)) return false;
  return Math.abs(left.age - right.age) <= SPOUSE_MAX_AGE_GAP;
};

const assignSpouseLinks = (list) => {
  // 기본은 동성 매칭(남/여)이고, 인종 제약은 canBeSpousePair에서 특성 예외까지 함께 처리한다.
  const males = list
    .filter((npc) => npc.gender === '남성' && isAdult(npc))
    .sort(() => Math.random() - 0.5);
  const females = list
    .filter((npc) => npc.gender === '여성' && isAdult(npc))
    .sort(() => Math.random() - 0.5);
  const availableFemaleIds = new Set(females.map((female) => female.id));

  males.forEach((male) => {
    if (male.familyLinks.spouseId) return;
    const partner = females.find((female) => availableFemaleIds.has(female.id) && canBeSpousePair(male, female));
    if (!partner) return;
    // 전체가 커플로 묶이지 않도록 확률 조건을 둔다.
    if (Math.random() >= SPOUSE_MATCH_CHANCE) return;
    male.familyLinks.spouseId = partner.id;
    partner.familyLinks.spouseId = male.id;
    // 1:1 혼인 관계를 보장하기 위해 매칭된 여성은 후보군에서 제거한다.
    availableFemaleIds.delete(partner.id);
    // 예외 규칙: 여성은 결혼 후 배우자(남성)의 가문으로만 편입한다. (성씨는 유지)
    partner.familyId = male.familyId;
  });

  // 안전망: 데이터가 오염되더라도 spouseId는 반드시 상호 1:1 참조만 남긴다.
  const byId = new Map(list.map((npc) => [npc.id, npc]));
  list.forEach((npc) => {
    const spouseId = npc.familyLinks.spouseId;
    if (!spouseId) return;
    const spouse = byId.get(spouseId);
    const blockedSiblingMarriage = areSiblings(npc, spouse) && !canBypassSiblingMarriageRestriction(npc, spouse);
    const blockedInterRaceMarriage = spouse && npc.race !== spouse.race && !canBypassInterRaceMarriageRestriction(npc, spouse);
    if (!spouse || spouse.familyLinks.spouseId !== npc.id || blockedSiblingMarriage || blockedInterRaceMarriage) {
      npc.familyLinks.spouseId = null;
    }
  });
};

const canBeAffairPair = (left, right) => {
  if (!left || !right || left.id === right.id) return false;
  if (!isAdult(left) || !isAdult(right)) return false;
  if (left.familyLinks.spouseId === right.id) return false;
  if ((left.familyLinks.affairPartnerIds || []).includes(right.id)) return false;
  if ((right.familyLinks.affairPartnerIds || []).includes(left.id)) return false;
  return true;
};

const hasAffairLimitBypassTrait = (npc) => {
  const acquiredTraitIds = npc?.traits?.acquiredTraitIds || [];
  if (npc?.gender === '남성') return acquiredTraitIds.includes(TRAIT_ID.CASANOVA);
  if (npc?.gender === '여성') return acquiredTraitIds.includes(TRAIT_ID.FEMME_FATALE);
  return false;
};

const canAcceptMoreAffairs = (npc) => {
  const current = (npc?.familyLinks?.affairPartnerIds || []).length;
  // 카사노바/팜므파탈 보유자는 연문 인원 제한을 적용하지 않는다.
  if (hasAffairLimitBypassTrait(npc)) return true;
  return current < MAX_AFFAIRS_DEFAULT;
};

const assignAffairLinks = (list) => {
  // 기본은 낮은 확률/최대 1명, 특성 예외(카사노바/팜므파탈)만 다중 연문을 허용한다.
  const adults = list.filter((npc) => isAdult(npc));
  const byId = new Map(adults.map((npc) => [npc.id, npc]));

  adults.forEach((npc) => {
    const married = Boolean(npc.familyLinks.spouseId);
    if (!married || !canAcceptMoreAffairs(npc)) return;
    if (Math.random() >= AFFAIR_TRIGGER_CHANCE) return;

    const candidates = adults.filter((other) => canBeAffairPair(npc, other) && canAcceptMoreAffairs(other));
    if (candidates.length === 0) return;

    // 특성 예외:
    // - 남성 카사노바 / 여성 팜므파탈은 연문 인원 제한 없이 다중 관계 가능.
    if (hasAffairLimitBypassTrait(npc)) {
      candidates.forEach((partner) => {
        if (!canAcceptMoreAffairs(partner) || !canBeAffairPair(npc, partner)) return;
        if (Math.random() >= AFFAIR_MULTI_CHANCE) return;
        npc.familyLinks.affairPartnerIds.push(partner.id);
        const partnerState = byId.get(partner.id);
        partnerState.familyLinks.affairPartnerIds.push(npc.id);
      });
      return;
    }

    const partner = pickOne(candidates.filter((other) => canAcceptMoreAffairs(other)));
    if (!partner) return;
    npc.familyLinks.affairPartnerIds.push(partner.id);
    const partnerState = byId.get(partner.id);
    partnerState.familyLinks.affairPartnerIds.push(npc.id);
  });
};

const assignFamilyLinks = (list) => {
  const byRace = new Map();
  const byId = new Map(list.map((npc) => [npc.id, npc]));
  list.forEach((npc) => {
    if (!byRace.has(npc.race)) byRace.set(npc.race, []);
    byRace.get(npc.race).push(npc);
  });

  list.forEach((child) => {
    const candidates = (byRace.get(child.race) || []).filter((npc) => npc.id !== child.id);
    const fatherCandidates = candidates.filter((npc) => npc.gender === '남성' && canBeParent(npc, child, 16));
    const motherCandidates = candidates.filter((npc) => npc.gender === '여성' && canBeParent(npc, child, 15));

    if (fatherCandidates.length > 0 && Math.random() < 0.72) {
      const father = pickOne(fatherCandidates);
      child.familyLinks.fatherId = father.id;
      father.familyLinks.childrenIds.push(child.id);
      child.familyId = father.familyId;
      child.name.surname = father.name.surname;
      child.name.full = `${child.name.surname} ${child.name.given}`;
    }

    if (motherCandidates.length > 0 && Math.random() < 0.68) {
      const mother = pickOne(motherCandidates);
      child.familyLinks.motherId = mother.id;
      mother.familyLinks.childrenIds.push(child.id);

      // 부계 성씨/가문 우선 규칙:
      // 아버지 정보가 없으면 어머니 성씨로 강제 변경하지 않는다.
      //
      // 이종 혼인은 허용되더라도 자녀는 불가:
      // - 현재 부모 후보를 child와 동일 종족으로만 뽑아서 자연스럽게 보장되지만,
      //   안전하게 한 번 더 차단해 미래 규칙 변경에도 의도를 유지한다.
      const father = byId.get(child.familyLinks.fatherId);
      if (father && father.familyLinks.spouseId === mother.id && father.race !== mother.race) {
        child.familyLinks.motherId = null;
        mother.familyLinks.childrenIds = mother.familyLinks.childrenIds.filter((id) => id !== child.id);
      }
    }
  });
};

const displayNpcName = (npc) => npc?.name?.full || '이름 없음';

const rebuildIndexes = () => {
  npcIndexes = {
    byId: new Map(),
    byRace: new Map(),
    byFamily: new Map(),
    byAffair: new Map(),
    byTrait: new Map()
  };

  npcList.forEach((npc) => {
    npcIndexes.byId.set(npc.id, npc);

    if (!npcIndexes.byRace.has(npc.race)) npcIndexes.byRace.set(npc.race, []);
    npcIndexes.byRace.get(npc.race).push(npc.id);

    if (!npcIndexes.byFamily.has(npc.familyId)) npcIndexes.byFamily.set(npc.familyId, []);
    npcIndexes.byFamily.get(npc.familyId).push(npc.id);

    (npc.familyLinks.affairPartnerIds || []).forEach((affairId) => {
      if (!npcIndexes.byAffair.has(affairId)) npcIndexes.byAffair.set(affairId, []);
      npcIndexes.byAffair.get(affairId).push(npc.id);
    });

    (npc.traits.acquiredTraitIds || []).forEach((traitId) => {
      if (!npcIndexes.byTrait.has(traitId)) npcIndexes.byTrait.set(traitId, []);
      npcIndexes.byTrait.get(traitId).push(npc.id);
    });
  });
};

const findNpcById = (id) => npcIndexes.byId.get(id);

const activateTab = (tabKey) => {
  tabButtons.forEach((button) => {
    button.classList.toggle('npc-tab--active', button.dataset.tabTarget === tabKey);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle('npc-tabpanel--active', panel.dataset.tabPanel === tabKey);
  });
};

// 공용 카드 템플릿(card_templates.js)을 이용해 NPC 테스트 전용 액션 덱을 구성한다.
const initActionDeck = () => {
  const cardApi = window.NewtheriaCardTemplates;
  if (!npcActionDeck || !cardApi) return;

  const cards = cardApi.renderCardFanCards(npcActionDeck, [
    { route: 'reroll', icon: '🎲', label: '월드 리롤', desc: 'NPC 100명을 새 시드로 재구성' },
    { route: 'sort_age', icon: '📈', label: '나이순 정렬', desc: '최고령부터 빠르게 정렬' },
    { route: 'sort_name', icon: '🔤', label: '이름순 정렬', desc: '한글 로케일 기준 정렬' },
    { route: 'compare', icon: '💞', label: '속궁합 팝업', desc: '두 캐릭터의 시드 궁합 비교' }
  ]);

  actionDeckBehavior?.destroy?.();
  actionDeckBehavior = cardApi.createCardFanBehavior({ menu: npcActionDeck, cards });
  actionDeckBehavior.layoutCards();
  actionDeckBehavior.bindInteractions({
    onCardSelected: (card) => {
      const route = card?.dataset?.route;
      if (route === 'reroll') regenerateNpcList();
      if (route === 'sort_age') {
        npcList.sort((a, b) => b.age - a.age);
        renderNpcList();
      }
      if (route === 'sort_name') {
        npcList.sort((a, b) => displayNpcName(a).localeCompare(displayNpcName(b), 'ko-KR'));
        renderNpcList();
      }
      if (route === 'compare') {
        syncCompareDialogSelection();
        if (!npcCompareDialog.open) npcCompareDialog.showModal();
      }
      cardApi.setActiveCard(cards, card);
    }
  });
};

const setCompareSlot = (slot, npcId) => {
  if (slot === 'left') compareSelection.leftId = npcId;
  if (slot === 'right') compareSelection.rightId = npcId;
  renderComparePreview();
  syncCompareDialogSelection();
};

const getComparePair = () => {
  const left = findNpcById(compareSelection.leftId);
  const right = findNpcById(compareSelection.rightId);
  return { left, right };
};

const renderComparePreview = () => {
  const { left, right } = getComparePair();
  if (!left || !right) {
    comparePreviewPair.textContent = '선택된 비교 대상이 없습니다.';
    comparePreviewBar.style.width = '0%';
    comparePreviewScore.textContent = '점수: 없음';
    return;
  }
  const score = calculateSeedCompatibilityPercent(left, right);
  comparePreviewPair.textContent = `${displayNpcName(left)} ↔ ${displayNpcName(right)}`;
  comparePreviewBar.style.width = `${score}%`;
  comparePreviewScore.textContent = `점수: ${score}%`;
};

const populateCompareSelectOptions = () => {
  const optionsHtml = npcList
    .map((npc) => `<option value="${npc.id}">${displayNpcName(npc)} · ${npc.race} · ${npc.age}세</option>`)
    .join('');
  compareNpcASelect.innerHTML = `<option value="">선택 안함</option>${optionsHtml}`;
  compareNpcBSelect.innerHTML = `<option value="">선택 안함</option>${optionsHtml}`;
};

const syncCompareDialogSelection = () => {
  compareNpcASelect.value = compareSelection.leftId ? String(compareSelection.leftId) : '';
  compareNpcBSelect.value = compareSelection.rightId ? String(compareSelection.rightId) : '';
  const { left, right } = getComparePair();
  if (!left || !right) {
    compareDialogBar.style.width = '0%';
    compareDialogScore.textContent = '점수: 없음';
    compareDialogMeta.textContent = '두 NPC를 선택하면 속궁합 비교 결과가 표시됩니다.';
    return;
  }
  const score = calculateSeedCompatibilityPercent(left, right);
  compareDialogBar.style.width = `${score}%`;
  compareDialogScore.textContent = `점수: ${score}%`;
  compareDialogMeta.textContent = `${displayNpcName(left)} ↔ ${displayNpcName(right)} · 시드 토러스 거리 기반`;
};

const createContextItem = (npcId) => {
  const npc = findNpcById(npcId);
  const li = document.createElement('li');

  if (!npc) {
    li.textContent = `ID ${npcId}`;
    return li;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'npc-context__item';
  button.textContent = `${displayNpcName(npc)} · ${npc.race} · ${npc.age}세`;
  button.addEventListener('click', () => openNpcDialog(npc));

  li.append(button);
  return li;
};

const renderContextPanel = (title, ids) => {
  npcContextList.replaceChildren();

  if (!ids || ids.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'npc-context__empty';
    empty.textContent = `${title}: 대상이 없습니다.`;
    npcContextList.append(empty);
    return;
  }

  const titleRow = document.createElement('li');
  titleRow.className = 'npc-context__title';
  titleRow.textContent = `${title} · ${ids.length}명`;

  npcContextList.append(titleRow, ...ids.slice(0, 30).map(createContextItem));
};

const buildSummary = () => {
  const raceCountMap = npcList.reduce((acc, npc) => {
    acc.set(npc.race, (acc.get(npc.race) || 0) + 1);
    return acc;
  }, new Map());

  const linkedChildren = npcList.filter((npc) => npc.familyLinks.fatherId || npc.familyLinks.motherId).length;

  const raceItems = Array.from(raceCountMap.entries())
    .map(([race, count]) => `<span class="npc-summary__pill">${race} ${count}명</span>`)
    .join('');

  npcSummaryElement.innerHTML = `
    <div class="npc-summary__line">총 <strong>${npcList.length}명</strong> 생성 완료</div>
    <div class="npc-summary__line">부모 정보 연결된 NPC: <strong>${linkedChildren}명</strong></div>
    <div class="npc-summary__pills">${raceItems}</div>
  `;

  renderContextPanel('초기 상태', npcList.map((npc) => npc.id).slice(0, 12));
};

const pointOnCircle = (cx, cy, radius, angle) => ({
  x: cx + Math.cos(angle) * radius,
  y: cy + Math.sin(angle) * radius
});

const renderRadarChart = (stats) => {
  radarChart.replaceChildren();

  const centerX = 130;
  const centerY = 130;
  const maxRadius = 90;
  const levelCount = 5;

  const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const axisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

  for (let level = 1; level <= levelCount; level += 1) {
    const radius = (maxRadius / levelCount) * level;
    const points = STAT_KEYS.map((_, index) => {
      const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / STAT_KEYS.length;
      const point = pointOnCircle(centerX, centerY, radius, angle);
      return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    }).join(' ');

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', points);
    polygon.setAttribute('class', 'npc-radar__grid');
    gridGroup.appendChild(polygon);
  }

  STAT_KEYS.forEach((key, index) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / STAT_KEYS.length;
    const outerPoint = pointOnCircle(centerX, centerY, maxRadius, angle);

    const axis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axis.setAttribute('x1', String(centerX));
    axis.setAttribute('y1', String(centerY));
    axis.setAttribute('x2', String(outerPoint.x));
    axis.setAttribute('y2', String(outerPoint.y));
    axis.setAttribute('class', 'npc-radar__axis');
    axisGroup.appendChild(axis);

    const labelPoint = pointOnCircle(centerX, centerY, maxRadius + 18, angle);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', labelPoint.x.toFixed(2));
    label.setAttribute('y', labelPoint.y.toFixed(2));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('class', 'npc-radar__label');
    label.textContent = `${key} ${stats[key]}`;
    labelGroup.appendChild(label);
  });

  const statPoints = STAT_KEYS.map((key, index) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / STAT_KEYS.length;
    const normalized = Math.min(20, Math.max(0, stats[key])) / 20;
    const point = pointOnCircle(centerX, centerY, maxRadius * normalized, angle);
    return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  }).join(' ');

  const statPolygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  statPolygon.setAttribute('points', statPoints);
  statPolygon.setAttribute('class', 'npc-radar__value');

  radarChart.append(gridGroup, axisGroup, statPolygon, labelGroup);
  radarChart.classList.remove('npc-radar--animate');
  requestAnimationFrame(() => radarChart.classList.add('npc-radar--animate'));
};

const createObjectButton = (label, onClick) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'npc-object-link';
  button.textContent = label;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
};

const createNameButton = (npcId) => {
  const npc = findNpcById(npcId);
  return createObjectButton(npc ? `${displayNpcName(npc)} (#${npc.id})` : `ID ${npcId}`, () => {
    if (npc) openNpcDialog(npc);
  });
};

const createRelativeListFragment = (ids) => {
  const fragment = document.createDocumentFragment();
  if (!ids || ids.length === 0) {
    fragment.append('없음');
    return fragment;
  }

  ids.forEach((id, index) => {
    fragment.append(createNameButton(id));
    if (index < ids.length - 1) fragment.append(document.createTextNode(', '));
  });
  return fragment;
};

const activateDetailTab = (tabKey) => {
  activeDetailTab = tabKey;
  detailTabs.forEach((button) => {
    button.classList.toggle('dialog-tab--active', button.dataset.detailTab === tabKey);
  });
};

const openTraitDialog = (traitId) => {
  const trait = TRAIT_BY_ID.get(traitId);
  if (!trait) return;
  traitDialogTitle.textContent = `특성: ${trait.name}`;
  traitDialogBody.innerHTML = `
    <article class="npc-dialog__row">
      <dt>설명</dt>
      <dd>${trait.description}</dd>
    </article>
    <article class="npc-dialog__row">
      <dt>메타 한줄평</dt>
      <dd>${traitMetaReviewOf(traitId)}</dd>
    </article>
    <article class="npc-dialog__row">
      <dt>분류</dt>
      <dd>${trait.type} · ${trait.rarity} · ID ${trait.id}</dd>
    </article>
  `;
  if (!traitDetailDialog.open) traitDetailDialog.showModal();
};

// 가문 족보 트리:
// - 기준 NPC를 루트로 삼고 부모/자녀를 재귀적으로 펼친다.
// - 순환 참조를 방지하기 위해 방문 집합을 사용한다.
const buildFamilyTreeNode = (npcId, depth, visited, maxDepth) => {
  const npc = findNpcById(npcId);
  const li = document.createElement('li');
  if (!npc) {
    li.textContent = `알 수 없는 구성원 #${npcId}`;
    return li;
  }
  const badge = document.createElement('button');
  badge.type = 'button';
  badge.className = `family-node ${depth === 0 ? 'family-node--root' : ''}`;
  badge.textContent = `${displayNpcName(npc)} · ${npc.age}세`;
  badge.addEventListener('click', () => openNpcDialog(npc));
  li.append(badge);

  if (depth >= maxDepth) return li;
  if (visited.has(npcId)) return li;
  visited.add(npcId);

  const relatives = [
    npc.familyLinks.fatherId,
    npc.familyLinks.motherId,
    ...(npc.familyLinks.childrenIds || [])
  ].filter(Boolean);

  if (relatives.length > 0) {
    const ul = document.createElement('ul');
    relatives.forEach((relativeId) => {
      ul.append(buildFamilyTreeNode(relativeId, depth + 1, new Set(visited), maxDepth));
    });
    li.append(ul);
  }
  return li;
};

const openFamilyTreeDialog = (rootNpc) => {
  const familyName = getFamilyName(rootNpc);
  familyTreeTitle.textContent = `가문 족보: ${familyName}`;
  familyTreeRoot.replaceChildren();
  const wrapper = document.createElement('ul');
  wrapper.append(buildFamilyTreeNode(rootNpc.id, 0, new Set(), 4));
  familyTreeRoot.append(wrapper);
  if (!familyTreeDialog.open) familyTreeDialog.showModal();
};

const openNpcDialog = (npc) => {
  activateDetailTab(activeDetailTab || 'overview');
  dialogNpcName.textContent = `${displayNpcName(npc)} (#${npc.id})`;
  const familyName = getFamilyName(npc);
  dialogNpcMeta.textContent = `${npc.race} · ${npc.gender} · ${npc.age}세 · ${familyName}`;

  renderRadarChart(npc.stats);

  const detailRows = [
    ['고유 시드', `${npc.uniqueSeed}${isSeedChecksumValid(npc.uniqueSeed) ? '' : ' (체크섬 경고)'}`],
    ['배우 ID', npc.actorId],
    ['종족', createObjectButton(npc.race, () => renderContextPanel(`종족: ${npc.race}`, npcIndexes.byRace.get(npc.race) || []))],
    ['가문', (() => {
      const frag = document.createDocumentFragment();
      frag.append(createObjectButton(familyName, () => renderContextPanel(`가문: ${familyName}`, npcIndexes.byFamily.get(npc.familyId) || [])));
      frag.append(createObjectButton('족보 트리', () => openFamilyTreeDialog(npc)));
      return frag;
    })()],
    ['배우자', npc.familyLinks.spouseId ? createRelativeListFragment([npc.familyLinks.spouseId]) : '없음'],
    ['속궁합(시드 기반)', (() => {
      const spouse = npc.familyLinks.spouseId ? findNpcById(npc.familyLinks.spouseId) : null;
      const percent = calculateSeedCompatibilityPercent(npc, spouse);
      return percent == null ? '없음' : `${percent}%`;
    })()],
    ['연문 관계', createRelativeListFragment(npc.familyLinks.affairPartnerIds || [])],
    ['아버지', npc.familyLinks.fatherId ? createRelativeListFragment([npc.familyLinks.fatherId]) : '없음'],
    ['어머니', npc.familyLinks.motherId ? createRelativeListFragment([npc.familyLinks.motherId]) : '없음'],
    ['자녀', createRelativeListFragment(npc.familyLinks.childrenIds)],
    ['후천 특성', (() => {
      const frag = document.createDocumentFragment();
      const acquiredTraitIds = npc.traits.acquiredTraitIds || [];
      acquiredTraitIds.forEach((traitId, index) => {
        const traitName = traitNameOf(traitId);
        frag.append(createObjectButton(`${traitName}`, () => openTraitDialog(traitId)));
        frag.append(createObjectButton('관련 NPC', () => renderContextPanel(`특성: ${traitName}`, npcIndexes.byTrait.get(traitId) || [])));
        if (index < acquiredTraitIds.length - 1) frag.append(document.createTextNode(' '));
      });
      return frag;
    })()]
  ];

  const visibleRowsByTab = {
    overview: ['고유 시드', '배우 ID', '종족', '가문', '속궁합(시드 기반)'],
    relation: ['배우자', '연문 관계', '아버지', '어머니', '자녀'],
    traits: ['후천 특성']
  };
  const visibleSet = new Set(visibleRowsByTab[activeDetailTab] || visibleRowsByTab.overview);

  dialogNpcDetail.replaceChildren(
    ...detailRows.filter(([label]) => visibleSet.has(label)).map(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'npc-dialog__row';

      const dt = document.createElement('dt');
      dt.textContent = label;

      const dd = document.createElement('dd');
      if (typeof value === 'string') dd.textContent = value;
      else dd.append(value);

      row.append(dt, dd);
      return row;
    })
  );

  if (!npcDetailDialog.open) npcDetailDialog.showModal();
};

const renderNpcList = () => {
  npcListElement.replaceChildren(
    ...npcList.map((npc) => {
      const card = document.createElement('li');
      card.className = 'npc-item';
      card.tabIndex = 0;
      card.role = 'button';
      card.setAttribute('aria-label', `${displayNpcName(npc)} 상세 정보 보기`);

      const nameButton = document.createElement('button');
      nameButton.type = 'button';
      nameButton.className = 'npc-item__name-button';
      nameButton.textContent = displayNpcName(npc);
      nameButton.addEventListener('click', (event) => {
        event.stopPropagation();
        openNpcDialog(npc);
      });

      const meta = document.createElement('p');
      meta.className = 'npc-item__meta';
      meta.textContent = `#${npc.id} · ${npc.race} · ${npc.age}세`;

      const relation = document.createElement('p');
      relation.className = 'npc-item__relation';
      const parents = [npc.familyLinks.fatherId, npc.familyLinks.motherId].filter(Boolean).length;
      const children = npc.familyLinks.childrenIds.length;
      const spouse = npc.familyLinks.spouseId ? 1 : 0;
      const affairs = (npc.familyLinks.affairPartnerIds || []).length;
      relation.textContent = `배우자 ${spouse} / 연문 ${affairs} / 부모 연결 ${parents} / 자녀 ${children}`;

      // 카드에는 특성 이름만 보여주고, 상세 설명은 팝업에서 확인하도록 분리한다.
      const chips = document.createElement('div');
      chips.className = 'npc-item__chips';
      (npc.traits.acquiredTraitIds || []).forEach((traitId) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'npc-chip';
        chip.textContent = traitNameOf(traitId);
        chip.addEventListener('click', (event) => {
          event.stopPropagation();
          openTraitDialog(traitId);
        });
        chips.append(chip);
      });

      const actionRow = document.createElement('div');
      actionRow.className = 'npc-item__actions';

      const compareLeft = document.createElement('button');
      compareLeft.type = 'button';
      compareLeft.className = 'npc-item__mini';
      compareLeft.textContent = '비교 A 지정';
      compareLeft.addEventListener('click', (event) => {
        event.stopPropagation();
        setCompareSlot('left', npc.id);
        activateTab('compare');
      });

      const compareRight = document.createElement('button');
      compareRight.type = 'button';
      compareRight.className = 'npc-item__mini';
      compareRight.textContent = '비교 B 지정';
      compareRight.addEventListener('click', (event) => {
        event.stopPropagation();
        setCompareSlot('right', npc.id);
        activateTab('compare');
      });

      const familyTreeButton = document.createElement('button');
      familyTreeButton.type = 'button';
      familyTreeButton.className = 'npc-item__mini';
      familyTreeButton.textContent = '가문 트리';
      familyTreeButton.addEventListener('click', (event) => {
        event.stopPropagation();
        openFamilyTreeDialog(npc);
      });

      actionRow.append(compareLeft, compareRight, familyTreeButton);

      card.append(nameButton, meta, relation, chips, actionRow);
      card.addEventListener('click', () => openNpcDialog(npc));
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openNpcDialog(npc);
        }
      });

      return card;
    })
  );
};

const regenerateNpcList = () => {
  const createSeed = createUniqueSeedGenerator();
  npcList = Array.from({ length: NPC_COUNT }, (_, index) => createNpcBase(index + 1, createSeed));
  // 가족(부모/자녀) 링크를 먼저 구성한 뒤 배우자 매칭을 해야 형제 혼인을 예방할 수 있다.
  assignFamilyLinks(npcList);
  assignSpouseLinks(npcList);
  assignAffairLinks(npcList);
  rebuildIndexes();
  buildSummary();
  renderNpcList();
  populateCompareSelectOptions();
  syncCompareDialogSelection();
  renderComparePreview();
};

const bindEvents = () => {
  generateButton.addEventListener('click', regenerateNpcList);

  sortByAgeButton.addEventListener('click', () => {
    npcList.sort((a, b) => b.age - a.age);
    renderNpcList();
  });

  sortByNameButton.addEventListener('click', () => {
    npcList.sort((a, b) => displayNpcName(a).localeCompare(displayNpcName(b), 'ko-KR'));
    renderNpcList();
  });

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.tabTarget));
  });
  detailTabs.forEach((button) => {
    button.addEventListener('click', () => {
      activateDetailTab(button.dataset.detailTab);
      const openedName = dialogNpcName.textContent || '';
      const currentNpcId = Number((openedName.match(/#(\d+)\)/) || [])[1]);
      if (currentNpcId) {
        const npc = findNpcById(currentNpcId);
        if (npc) openNpcDialog(npc);
      }
    });
  });

  openCompareDialogButton.addEventListener('click', () => {
    syncCompareDialogSelection();
    if (!npcCompareDialog.open) npcCompareDialog.showModal();
  });

  compareNpcASelect.addEventListener('change', () => {
    compareSelection.leftId = compareNpcASelect.value ? Number(compareNpcASelect.value) : null;
    syncCompareDialogSelection();
    renderComparePreview();
  });

  compareNpcBSelect.addEventListener('change', () => {
    compareSelection.rightId = compareNpcBSelect.value ? Number(compareNpcBSelect.value) : null;
    syncCompareDialogSelection();
    renderComparePreview();
  });
};

const isValidRaceNamePool = (pool) => (
  pool
  && Array.isArray(pool.male) && pool.male.length > 0
  && Array.isArray(pool.female) && pool.female.length > 0
  && Array.isArray(pool.surnames) && pool.surnames.length > 0
);

const loadNamePools = async () => {
  try {
    const response = await fetch(NAME_POOL_PATH, { cache: 'no-store' });
    if (!response.ok) throw new Error('이름 풀 파일 로드 실패');

    const parsed = await response.json();
    const hasEveryRacePool = RACE_POOL.every((raceInfo) => isValidRaceNamePool(parsed[raceInfo.key]));
    if (hasEveryRacePool) namePools = parsed;
  } catch (error) {
    console.warn('[npc_test] 이름 풀 로드 실패, 기본 이름 풀로 진행합니다.', error);
  }
};

const bootstrap = async () => {
  await loadNamePools();
  initActionDeck();
  regenerateNpcList();
  bindEvents();
  activateTab('summary');
};

bootstrap();
