const NPC_COUNT = 300;
const NAME_POOL_PATH = './assets/data/npc_name_pools.json';

const ADULT_AGE = 18;
const SPOUSE_MAX_AGE_GAP = 24;
const SPOUSE_MATCH_CHANCE = 0.58;
const AFFAIR_TRIGGER_CHANCE = 0.08;
const AFFAIR_MULTI_CHANCE = 0.22;
const MAX_AFFAIRS_DEFAULT = 1;

const TRAIT_ID = { CASANOVA: 311, FEMME_FATALE: 312, INCEST_INCLINATION: 313, ANYTHING_GOES: 314 };
const SEED_COMPATIBILITY = { axisSize: 1000, axisMid: 500, scorePower: 1.2 };
const STAT_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

const RACE_POOL = [
  { name: '인간', key: 'human', adultAge: 18, elderAge: 60, maxAge: 85 },
  { name: '엘프', key: 'elf', adultAge: 30, elderAge: 180, maxAge: 320 },
  { name: '드워프', key: 'dwarf', adultAge: 24, elderAge: 120, maxAge: 210 },
  { name: '용인', key: 'dragonborn', adultAge: 22, elderAge: 140, maxAge: 240 }
];

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
  { id: 313, name: '근친 성향', type: '페티시', rarity: '전설', description: '형제(이복 포함) 간 혼인 제한을 무시한다.' },
  { id: 314, name: '가능충', type: '페티시', rarity: '전설', description: '이종 간 혼인 제한을 무시한다. (단, 이종 배우자끼리는 자녀 불가)' }
];

const TRAIT_META_REVIEW_BY_ID = new Map([
  [301, '판을 읽는 지휘형 인재'], [302, '어디서든 분위기를 푸는 친화형'], [303, '밤 전장에서 빛나는 정찰형'],
  [304, '감각으로 먹고사는 야생형'], [305, '고장 나면 가장 먼저 찾는 해결사'], [306, '약초창고의 살아있는 도감'],
  [307, '소모품을 자산으로 바꾸는 생활형'], [308, '말 한마디로 전황을 바꾸는 선동형'], [309, '불길 속에서도 버티는 내열형'],
  [310, '지도를 머릿속에 넣고 다니는 탐지형'], [311, '관계 확장을 멈추지 않는 연애 과열형'], [312, '치명적 매력으로 관계를 설계하는 유혹형'],
  [313, '금기선마저 넘는 집착형 페티시'], [314, '종족 경계도 무시하는 초개방형 페티시']
]);

const DEFAULT_NAME_POOLS = {
  human: { male: ['리처드', '윌리엄', '에드워드', '토마스', '로버트'], female: ['메리', '제인', '엘리자베스', '아멜리아', '캐서린'], surnames: ['스미스', '윈저', '랭커스터', '튜더', '브루스'] },
  elf: { male: ['파엔다르', '엘라리안', '실리온', '갈라디르', '레놀라스'], female: ['아라엘', '리리엔', '니무에', '베스퍼', '티란디아'], surnames: ['윈드러너', '실버리프', '스타폴', '문위스퍼', '선스트라이더'] },
  dwarf: { male: ['소림', '코르바도르', '바인', '그롬나르', '타르간'], female: ['헬가', '다이나', '브룬힐다', '디스', '모이라'], surnames: ['스톤해머', '아이언포지', '브론즈비어드', '락크러셔', '실버베인'] },
  dragonborn: { male: ['드라가르', '록사르', '발라사', '아르잔', '토린바르'], female: ['크리나', '파리데', '소라', '젤렌', '다라'], surnames: ['아이언스케일', '플레임텅', '블러드혼', '레드팽', '드래곤베인'] }
};

const TRAIT_BY_ID = new Map(TRAIT_CATALOG.map((trait) => [trait.id, trait]));
const FAMILY_NAME_BY_ID = new Map();

const $ = (id) => document.getElementById(id);
const npcGalaxy = $('npcGalaxy');
const raceFilter = $('raceFilter');
const npcSearchInput = $('npcSearchInput');
const compareNpcA = $('compareNpcA');
const compareNpcB = $('compareNpcB');
const compatBar = $('compatBar');
const compatLabel = $('compatLabel');
const compatMeta = $('compatMeta');
const topPairs = $('topPairs');
const familyBoard = $('familyBoard');
const mainActionDeck = $('mainActionDeck');

const npcProfileDialog = $('npcProfileDialog');
const profileName = $('profileName');
const profileMeta = $('profileMeta');
const profilePanel = $('profilePanel');
const traitDialog = $('traitDialog');
const traitTitle = $('traitTitle');
const traitBody = $('traitBody');
const familyTreeDialog = $('familyTreeDialog');
const familyTreeTitle = $('familyTreeTitle');
const familyPedigreeBoard = $('familyPedigreeBoard');

const navTabs = Array.from(document.querySelectorAll('.nav-tab'));
const screens = Array.from(document.querySelectorAll('[data-screen-panel]'));
const profileTabs = Array.from(document.querySelectorAll('.profile-tab'));

let npcList = [];
let namePools = DEFAULT_NAME_POOLS;
let selectedA = null;
let selectedB = null;
let profileTab = 'identity';
let actionDeckBehavior = null;
let currentSearch = '';
let currentRaceFilter = '';
let npcIndexes = { byId: new Map(), byRace: new Map(), byFamily: new Map(), byTrait: new Map() };

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickOne = (pool) => pool[randomInt(0, pool.length - 1)];
const displayNpcName = (npc) => npc?.name?.full || '이름 없음';
const traitNameOf = (traitId) => TRAIT_BY_ID.get(traitId)?.name || `미정특성#${traitId}`;
const traitMetaReviewOf = (traitId) => TRAIT_META_REVIEW_BY_ID.get(traitId) || '특성 메타 한줄평 미정';
const isAdult = (npc) => (npc?.age || 0) >= ADULT_AGE;
const hasAcquiredTrait = (npc, traitId) => (npc?.traits?.acquiredTraitIds || []).includes(traitId);

const computeSeedChecksum = (payload) => payload.split('').reduce((acc, digit) => acc + Number(digit), 0) % 10;
const attachSeedChecksum = (payload) => `${payload}${computeSeedChecksum(payload)}`;
const seedToTorusPoint = (seed) => {
  const payload = String(seed || '').replace(/\D/g, '').slice(0, 9).padEnd(9, '0');
  return [Number(payload.slice(0, 3)), Number(payload.slice(3, 6)), Number(payload.slice(6, 9))];
};

const torusAxisDistance = (a, b, size) => Math.min(Math.abs(a - b), size - Math.abs(a - b));
const calculateSeedCompatibilityPercent = (left, right) => {
  if (!left || !right) return null;
  const lp = seedToTorusPoint(left.uniqueSeed);
  const rp = seedToTorusPoint(right.uniqueSeed);
  const d = Math.hypot(...lp.map((v, i) => torusAxisDistance(v, rp[i], SEED_COMPATIBILITY.axisSize)));
  const maxD = Math.sqrt(3 * (SEED_COMPATIBILITY.axisMid ** 2));
  return Math.round(Math.max(0, Math.min(100, 100 * (1 - (Math.min(d / maxD, 1) ** SEED_COMPATIBILITY.scorePower)))));
};

const createUniqueSeedGenerator = () => {
  const used = new Set();
  return () => {
    while (true) {
      const payload = String(randomInt(100_000_000, 999_999_999));
      const seed = attachSeedChecksum(payload);
      if (!used.has(seed)) { used.add(seed); return seed; }
    }
  };
};

const normalizeFamilyIdToken = (v = '') => String(v).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9가-힣_]/g, '');
const ensureFamilyBySurname = (surname = '') => {
  const safeSurname = String(surname || '').trim() || '무명';
  const familyId = `house_${normalizeFamilyIdToken(safeSurname) || 'unknown'}`;
  if (!FAMILY_NAME_BY_ID.has(familyId)) FAMILY_NAME_BY_ID.set(familyId, `${safeSurname}가문`);
  return familyId;
};

const getFamilyName = (npc) => FAMILY_NAME_BY_ID.get(npc?.familyId) || npc?.familyId || '무가문';
const createAgeForRace = (raceInfo) => {
  const d = Math.random();
  if (d < 0.14) return randomInt(0, raceInfo.adultAge - 1);
  if (d < 0.82) return randomInt(raceInfo.adultAge, raceInfo.elderAge - 1);
  return randomInt(raceInfo.elderAge, raceInfo.maxAge);
};

const createStats = () => ({ STR: randomInt(6, 20), DEX: randomInt(6, 20), CON: randomInt(6, 20), INT: randomInt(6, 20), WIS: randomInt(6, 20), CHA: randomInt(6, 20) });
const pickRaceNameParts = (raceInfo, gender) => {
  const raceNames = namePools[raceInfo.key] || DEFAULT_NAME_POOLS[raceInfo.key];
  const givenPool = gender === '남성' ? raceNames.male : raceNames.female;
  return { surname: pickOne(raceNames.surnames), givenName: pickOne(givenPool) };
};

const createNpcBase = (id, createSeed) => {
  const raceInfo = pickOne(RACE_POOL);
  const gender = Math.random() < 0.5 ? '남성' : '여성';
  const nameParts = pickRaceNameParts(raceInfo, gender);
  return {
    id,
    actorId: `random_npc_${String(id).padStart(3, '0')}`,
    uniqueSeed: createSeed(),
    role: 'npc',
    familyId: ensureFamilyBySurname(nameParts.surname),
    name: { surname: nameParts.surname, given: nameParts.givenName, full: `${nameParts.surname} ${nameParts.givenName}` },
    gender,
    age: createAgeForRace(raceInfo),
    race: raceInfo.name,
    stats: createStats(),
    familyLinks: { fatherId: null, motherId: null, spouseId: null, affairPartnerIds: [], childrenIds: [] },
    traits: { acquiredTraitIds: [pickOne(TRAIT_CATALOG).id, pickOne(TRAIT_CATALOG).id] }
  };
};

const canBeParent = (npc, child, minGap) => npc.race === child.race && npc.age - child.age >= minGap;
const areSiblings = (l, r) => Boolean((l?.familyLinks?.fatherId && l.familyLinks.fatherId === r?.familyLinks?.fatherId) || (l?.familyLinks?.motherId && l.familyLinks.motherId === r?.familyLinks?.motherId));
const canBypassSiblingMarriageRestriction = (l, r) => hasAcquiredTrait(l, TRAIT_ID.INCEST_INCLINATION) || hasAcquiredTrait(r, TRAIT_ID.INCEST_INCLINATION);
const canBypassInterRaceMarriageRestriction = (l, r) => hasAcquiredTrait(l, TRAIT_ID.ANYTHING_GOES) || hasAcquiredTrait(r, TRAIT_ID.ANYTHING_GOES);

const canBeSpousePair = (l, r) => {
  if (!l || !r || l.id === r.id) return false;
  if (l.race !== r.race && !canBypassInterRaceMarriageRestriction(l, r)) return false;
  if (l.gender === r.gender || !isAdult(l) || !isAdult(r) || l.familyLinks.spouseId || r.familyLinks.spouseId) return false;
  if (areSiblings(l, r) && !canBypassSiblingMarriageRestriction(l, r)) return false;
  return Math.abs(l.age - r.age) <= SPOUSE_MAX_AGE_GAP;
};

const assignFamilyLinks = (list) => {
  const byRace = new Map();
  const byId = new Map(list.map((npc) => [npc.id, npc]));
  list.forEach((npc) => { if (!byRace.has(npc.race)) byRace.set(npc.race, []); byRace.get(npc.race).push(npc); });

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
      const father = byId.get(child.familyLinks.fatherId);
      if (father && father.familyLinks.spouseId === mother.id && father.race !== mother.race) {
        child.familyLinks.motherId = null;
        mother.familyLinks.childrenIds = mother.familyLinks.childrenIds.filter((id) => id !== child.id);
      }
    }
  });
};

const assignSpouseLinks = (list) => {
  const males = list.filter((npc) => npc.gender === '남성' && isAdult(npc)).sort(() => Math.random() - 0.5);
  const females = list.filter((npc) => npc.gender === '여성' && isAdult(npc)).sort(() => Math.random() - 0.5);
  const availableFemaleIds = new Set(females.map((f) => f.id));

  males.forEach((male) => {
    if (male.familyLinks.spouseId) return;
    const partner = females.find((f) => availableFemaleIds.has(f.id) && canBeSpousePair(male, f));
    if (!partner || Math.random() >= SPOUSE_MATCH_CHANCE) return;
    male.familyLinks.spouseId = partner.id;
    partner.familyLinks.spouseId = male.id;
    availableFemaleIds.delete(partner.id);
    partner.familyId = male.familyId;
  });

  const byId = new Map(list.map((npc) => [npc.id, npc]));
  list.forEach((npc) => {
    const spouse = byId.get(npc.familyLinks.spouseId);
    const invalid = !spouse
      || spouse.familyLinks.spouseId !== npc.id
      || (areSiblings(npc, spouse) && !canBypassSiblingMarriageRestriction(npc, spouse))
      || (npc.race !== spouse.race && !canBypassInterRaceMarriageRestriction(npc, spouse));
    if (invalid) npc.familyLinks.spouseId = null;
  });
};

const hasAffairLimitBypassTrait = (npc) => (npc?.gender === '남성' ? hasAcquiredTrait(npc, TRAIT_ID.CASANOVA) : hasAcquiredTrait(npc, TRAIT_ID.FEMME_FATALE));
const canAcceptMoreAffairs = (npc) => hasAffairLimitBypassTrait(npc) || (npc?.familyLinks?.affairPartnerIds || []).length < MAX_AFFAIRS_DEFAULT;
const canBeAffairPair = (l, r) => l && r && l.id !== r.id && isAdult(l) && isAdult(r) && l.familyLinks.spouseId !== r.id && !(l.familyLinks.affairPartnerIds || []).includes(r.id) && !(r.familyLinks.affairPartnerIds || []).includes(l.id);

const assignAffairLinks = (list) => {
  const adults = list.filter((npc) => isAdult(npc));
  const byId = new Map(adults.map((npc) => [npc.id, npc]));

  adults.forEach((npc) => {
    if (!npc.familyLinks.spouseId || !canAcceptMoreAffairs(npc) || Math.random() >= AFFAIR_TRIGGER_CHANCE) return;
    const candidates = adults.filter((other) => canBeAffairPair(npc, other) && canAcceptMoreAffairs(other));
    if (candidates.length === 0) return;

    if (hasAffairLimitBypassTrait(npc)) {
      candidates.forEach((partner) => {
        if (!canAcceptMoreAffairs(partner) || !canBeAffairPair(npc, partner) || Math.random() >= AFFAIR_MULTI_CHANCE) return;
        npc.familyLinks.affairPartnerIds.push(partner.id);
        byId.get(partner.id).familyLinks.affairPartnerIds.push(npc.id);
      });
      return;
    }

    const partner = pickOne(candidates);
    npc.familyLinks.affairPartnerIds.push(partner.id);
    byId.get(partner.id).familyLinks.affairPartnerIds.push(npc.id);
  });
};

const rebuildIndexes = () => {
  npcIndexes = { byId: new Map(), byRace: new Map(), byFamily: new Map(), byTrait: new Map() };
  npcList.forEach((npc) => {
    npcIndexes.byId.set(npc.id, npc);
    if (!npcIndexes.byRace.has(npc.race)) npcIndexes.byRace.set(npc.race, []);
    npcIndexes.byRace.get(npc.race).push(npc.id);
    if (!npcIndexes.byFamily.has(npc.familyId)) npcIndexes.byFamily.set(npc.familyId, []);
    npcIndexes.byFamily.get(npc.familyId).push(npc.id);
    (npc.traits.acquiredTraitIds || []).forEach((id) => {
      if (!npcIndexes.byTrait.has(id)) npcIndexes.byTrait.set(id, []);
      npcIndexes.byTrait.get(id).push(npc.id);
    });
  });
};

const findNpcById = (id) => npcIndexes.byId.get(id);

const activateScreen = (screenKey) => {
  navTabs.forEach((tab) => tab.classList.toggle('is-active', tab.dataset.screen === screenKey));
  screens.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.screenPanel === screenKey));
};

const activateProfileTab = (tabKey) => {
  profileTab = tabKey;
  profileTabs.forEach((tab) => tab.classList.toggle('is-active', tab.dataset.profileTab === tabKey));
};

const openTraitDialog = (traitId) => {
  const trait = TRAIT_BY_ID.get(traitId);
  if (!trait) return;

  // 요청사항 유지: 목록은 이름만, 설명/메타 정보는 팝업에서 제공.
  traitTitle.textContent = `특성: ${trait.name}`;
  traitBody.innerHTML = `
    <article class="info-row"><dt>설명</dt><dd>${trait.description}</dd></article>
    <article class="info-row"><dt>메타 한줄평</dt><dd>${traitMetaReviewOf(traitId)}</dd></article>
    <article class="info-row"><dt>메타 정보</dt><dd>${trait.type} · ${trait.rarity} · ID ${trait.id}</dd></article>
  `;
  if (!traitDialog.open) traitDialog.showModal();
};

const createNpcEntity = (npcId) => {
  const npc = findNpcById(npcId);
  if (!npc) return document.createTextNode('없음');
  const entity = document.createElement('span');
  entity.className = 'inline-entity';
  entity.tabIndex = 0;
  entity.role = 'button';
  entity.textContent = `${displayNpcName(npc)} (#${npcId})`;
  const onOpen = () => openNpcProfile(npc);
  entity.addEventListener('click', onOpen);
  entity.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  });
  return entity;
};

const createInfoRow = (label, valueNodeOrText) => {
  const row = document.createElement('dl');
  row.className = 'info-row';
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  if (typeof valueNodeOrText === 'string') dd.textContent = valueNodeOrText;
  else dd.append(valueNodeOrText);
  row.append(dt, dd);
  return row;
};

const renderStatsRows = (npc) => {
  const frag = document.createDocumentFragment();
  STAT_KEYS.forEach((key) => frag.append(createInfoRow(key, String(npc.stats[key]))));
  return frag;
};

const openNpcProfile = (npc) => {
  profileName.textContent = `${displayNpcName(npc)} (#${npc.id})`;
  profileMeta.textContent = `${npc.race} · ${npc.gender} · ${npc.age}세 · ${getFamilyName(npc)}`;

  const panel = document.createDocumentFragment();
  if (profileTab === 'identity') {
    panel.append(
      createInfoRow('고유 시드', npc.uniqueSeed),
      createInfoRow('배우 ID', npc.actorId),
      createInfoRow('가문', getFamilyName(npc)),
      createInfoRow('속궁합(배우자 기준)', (() => {
        const spouse = findNpcById(npc.familyLinks.spouseId);
        const score = calculateSeedCompatibilityPercent(npc, spouse);
        return score == null ? '없음' : `${score}%`;
      })())
    );
  }

  if (profileTab === 'relations') {
    panel.append(
      createInfoRow('배우자', npc.familyLinks.spouseId ? createNpcEntity(npc.familyLinks.spouseId) : '없음'),
      createInfoRow('아버지', npc.familyLinks.fatherId ? createNpcEntity(npc.familyLinks.fatherId) : '없음'),
      createInfoRow('어머니', npc.familyLinks.motherId ? createNpcEntity(npc.familyLinks.motherId) : '없음'),
      createInfoRow('자녀', (() => {
        const wrap = document.createElement('div');
        const children = npc.familyLinks.childrenIds || [];
        if (children.length === 0) return document.createTextNode('없음');
        children.forEach((id) => wrap.append(createNpcEntity(id), document.createTextNode(' ')));
        return wrap;
      })()),
      createInfoRow('연문 관계', (() => {
        const wrap = document.createElement('div');
        const affairs = npc.familyLinks.affairPartnerIds || [];
        if (affairs.length === 0) return document.createTextNode('없음');
        affairs.forEach((id) => wrap.append(createNpcEntity(id), document.createTextNode(' ')));
        return wrap;
      })())
    );
  }

  if (profileTab === 'traits') {
    const wrap = document.createElement('div');
    (npc.traits.acquiredTraitIds || []).forEach((traitId) => {
      const entity = document.createElement('span');
      entity.className = 'inline-entity';
      entity.textContent = traitNameOf(traitId);
      entity.tabIndex = 0;
      entity.role = 'button';
      const onOpen = () => openTraitDialog(traitId);
      entity.addEventListener('click', onOpen);
      entity.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      });
      wrap.append(entity, document.createTextNode(' '));
    });
    panel.append(createInfoRow('후천 특성', wrap));
  }

  if (profileTab === 'stats') panel.append(renderStatsRows(npc));

  profilePanel.replaceChildren(panel);
  if (!npcProfileDialog.open) npcProfileDialog.showModal();
};

const createPedigreeNode = (npc, isRoot = false) => {
  const node = document.createElement('article');
  node.className = `pedigree-node${isRoot ? ' pedigree-node--root' : ''}`;
  node.innerHTML = `<strong>${displayNpcName(npc)}</strong><span>${npc.age}세</span>`;
  node.addEventListener('click', () => openNpcProfile(npc));
  return node;
};

const collectLevels = (seedIds, nextGetter, maxDepth = 3) => {
  const levels = [];
  let current = [...seedIds];
  let depth = 0;
  const visited = new Set(seedIds);
  while (current.length > 0 && depth < maxDepth) {
    levels.push(current);
    const next = [];
    current.forEach((id) => {
      const npc = findNpcById(id);
      if (!npc) return;
      nextGetter(npc).forEach((nextId) => {
        if (!visited.has(nextId)) {
          visited.add(nextId);
          next.push(nextId);
        }
      });
    });
    current = next;
    depth += 1;
  }
  return levels;
};

const openFamilyTree = (rootNpc) => {
  familyTreeTitle.textContent = `패밀리 트리: ${displayNpcName(rootNpc)} · ${getFamilyName(rootNpc)}`;

  const ancestorLevels = collectLevels(
    [rootNpc.id],
    (npc) => [npc.familyLinks.fatherId, npc.familyLinks.motherId].filter(Boolean),
    4
  ).slice(1).reverse();
  const descendantLevels = collectLevels([rootNpc.id], (npc) => npc.familyLinks.childrenIds || [], 4).slice(1);

  const rows = [];
  ancestorLevels.forEach((level) => {
    const row = document.createElement('section');
    row.className = 'pedigree-row';
    level.map(findNpcById).filter(Boolean).forEach((npc) => row.append(createPedigreeNode(npc)));
    rows.push(row);
  });

  const rootRow = document.createElement('section');
  rootRow.className = 'pedigree-row';
  rootRow.append(createPedigreeNode(rootNpc, true));
  rows.push(rootRow);

  descendantLevels.forEach((level) => {
    const row = document.createElement('section');
    row.className = 'pedigree-row';
    level.map(findNpcById).filter(Boolean).forEach((npc) => row.append(createPedigreeNode(npc)));
    rows.push(row);
  });

  familyPedigreeBoard.replaceChildren(...rows);
  if (!familyTreeDialog.open) familyTreeDialog.showModal();
};

const renderTopCompatibilityPairs = () => {
  // O(n^2) 비용이므로 UX를 위해 상위 몇 개만 계산/표시.
  const pairs = [];
  for (let i = 0; i < npcList.length; i += 1) {
    for (let j = i + 1; j < npcList.length; j += 1) {
      if (pairs.length > 7000) break;
      const score = calculateSeedCompatibilityPercent(npcList[i], npcList[j]);
      pairs.push({ left: npcList[i], right: npcList[j], score });
    }
    if (pairs.length > 7000) break;
  }

  pairs.sort((a, b) => b.score - a.score);
  topPairs.replaceChildren(...pairs.slice(0, 14).map((pair) => {
    const li = document.createElement('li');
    li.textContent = `${displayNpcName(pair.left)} ↔ ${displayNpcName(pair.right)} : ${pair.score}%`;
    li.addEventListener('click', () => {
      selectedA = pair.left.id;
      selectedB = pair.right.id;
      compareNpcA.value = String(selectedA);
      compareNpcB.value = String(selectedB);
      syncCompatibilityPanel();
    });
    return li;
  }));
};

const syncCompatibilityPanel = () => {
  const a = findNpcById(selectedA);
  const b = findNpcById(selectedB);
  if (!a || !b) {
    compatBar.style.width = '0%';
    compatLabel.textContent = '점수: 없음';
    compatMeta.textContent = '두 NPC를 선택하면 결과가 표시됩니다.';
    return;
  }
  const score = calculateSeedCompatibilityPercent(a, b);
  compatBar.style.width = `${score}%`;
  compatLabel.textContent = `점수: ${score}%`;
  compatMeta.textContent = `${displayNpcName(a)} ↔ ${displayNpcName(b)} (시드 토러스 거리 기반)`;
};

const matchesFilter = (npc) => {
  if (currentRaceFilter && npc.race !== currentRaceFilter) return false;
  if (!currentSearch) return true;
  const q = currentSearch.toLowerCase();
  return [displayNpcName(npc), npc.race, getFamilyName(npc), npc.gender].some((token) => String(token).toLowerCase().includes(q));
};

const renderNpcGalaxy = () => {
  const filtered = npcList.filter(matchesFilter);
  const orbit = document.createElement('div');
  orbit.className = 'npc-orbit';

  const center = { x: 0, y: 0 };
  const orbitRadius = Math.max(210, 250 + (filtered.length * 0.45));

  orbit.replaceChildren(...filtered.map((npc, index) => {
    const card = document.createElement('article');
    card.className = 'npc-star-card';
    card.tabIndex = 0;
    card.role = 'button';

    // 원형 팬 배치: 카드들을 큰 원 둘레에 배치한다.
    const angle = ((Math.PI * 2) / Math.max(filtered.length, 1)) * index;
    const x = center.x + Math.cos(angle) * orbitRadius;
    const y = center.y + Math.sin(angle) * orbitRadius;
    card.style.transform = `translate(${x}px, ${y}px)`;

    const title = document.createElement('h3');
    title.textContent = displayNpcName(npc);
    const meta = document.createElement('p');
    meta.textContent = `#${npc.id} · ${npc.race} · ${npc.gender} · ${npc.age}세 · ${getFamilyName(npc)}`;
    const relation = document.createElement('p');
    relation.textContent = `배우자 ${npc.familyLinks.spouseId ? 1 : 0} / 연문 ${(npc.familyLinks.affairPartnerIds || []).length} / 자녀 ${(npc.familyLinks.childrenIds || []).length}`;

    const row = document.createElement('div');
    row.className = 'inline-actions';

    const compareABtn = document.createElement('span');
    compareABtn.className = 'inline-entity';
    compareABtn.textContent = '비교A';
    compareABtn.addEventListener('click', (event) => {
      event.stopPropagation();
      selectedA = npc.id;
      compareNpcA.value = String(npc.id);
      activateScreen('chemistry');
      syncCompatibilityPanel();
    });

    const compareBBtn = document.createElement('span');
    compareBBtn.className = 'inline-entity';
    compareBBtn.textContent = '비교B';
    compareBBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      selectedB = npc.id;
      compareNpcB.value = String(npc.id);
      activateScreen('chemistry');
      syncCompatibilityPanel();
    });

    const treeBtn = document.createElement('span');
    treeBtn.className = 'inline-entity';
    treeBtn.textContent = '가문트리';
    treeBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      openFamilyTree(npc);
    });

    row.append(compareABtn, compareBBtn, treeBtn);

    // 요청사항: 특성은 이름만 노출.
    (npc.traits.acquiredTraitIds || []).forEach((traitId) => {
      const traitBtn = document.createElement('span');
      traitBtn.className = 'inline-entity';
      traitBtn.textContent = traitNameOf(traitId);
      traitBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        openTraitDialog(traitId);
      });
      row.append(traitBtn);
    });

    card.append(title, meta, relation, row);
    card.addEventListener('click', () => openNpcProfile(npc));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openNpcProfile(npc);
      }
    });
    return card;
  }));

  npcGalaxy.replaceChildren(orbit);
};

const renderFamilyBoard = () => {
  const familyEntries = Array.from(npcIndexes.byFamily.entries()).sort((a, b) => b[1].length - a[1].length);
  familyBoard.replaceChildren(...familyEntries.map(([familyId, npcIds]) => {
    const tile = document.createElement('article');
    tile.className = 'family-tile';

    const name = document.createElement('h3');
    name.textContent = FAMILY_NAME_BY_ID.get(familyId) || familyId;

    const info = document.createElement('p');
    info.className = 'muted';
    info.textContent = `구성원 ${npcIds.length}명`;

    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = '대표 인물 트리 보기';
    open.addEventListener('click', () => {
      const head = findNpcById(npcIds[0]);
      if (head) openFamilyTree(head);
    });

    tile.append(name, info, open);
    return tile;
  }));
};

const populateFilters = () => {
  const races = Array.from(new Set(npcList.map((npc) => npc.race)));
  raceFilter.innerHTML = `<option value="">전체 종족</option>${races.map((race) => `<option value="${race}">${race}</option>`).join('')}`;

  const options = npcList.map((npc) => `<option value="${npc.id}">${displayNpcName(npc)} · ${npc.race} · ${npc.age}세</option>`).join('');
  compareNpcA.innerHTML = `<option value="">선택 안함</option>${options}`;
  compareNpcB.innerHTML = `<option value="">선택 안함</option>${options}`;
};

const regenerateNpcList = () => {
  const createSeed = createUniqueSeedGenerator();
  npcList = Array.from({ length: NPC_COUNT }, (_, index) => createNpcBase(index + 1, createSeed));

  assignFamilyLinks(npcList);
  assignSpouseLinks(npcList);
  assignAffairLinks(npcList);
  rebuildIndexes();

  populateFilters();
  renderNpcGalaxy();
  renderFamilyBoard();
  renderTopCompatibilityPairs();
  syncCompatibilityPanel();
};

const initMainActionDeck = () => {
  const api = window.NewtheriaCardTemplates;
  if (!api || !mainActionDeck) return;

  const cards = api.renderCardFanCards(mainActionDeck, [
    { route: 'reroll', icon: '🎲', label: '월드 리롤', desc: 'NPC 월드 재생성' },
    { route: 'age', icon: '📈', label: '나이순', desc: '최고령부터 정렬' },
    { route: 'name', icon: '🔤', label: '이름순', desc: '한글 로케일 정렬' },
    { route: 'chem', icon: '💞', label: '속궁합 탭', desc: '비교 화면으로 이동' }
  ]);

  actionDeckBehavior?.destroy?.();
  actionDeckBehavior = api.createCardFanBehavior({ menu: mainActionDeck, cards });
  actionDeckBehavior.layoutCards();
  actionDeckBehavior.bindInteractions({
    onCardSelected: (card) => {
      const route = card?.dataset?.route;
      if (route === 'reroll') regenerateNpcList();
      if (route === 'age') { npcList.sort((a, b) => b.age - a.age); renderNpcGalaxy(); }
      if (route === 'name') { npcList.sort((a, b) => displayNpcName(a).localeCompare(displayNpcName(b), 'ko-KR')); renderNpcGalaxy(); }
      if (route === 'chem') activateScreen('chemistry');
      api.setActiveCard(cards, card);
    }
  });
};

const isValidRaceNamePool = (pool) => pool && Array.isArray(pool.male) && pool.male.length > 0 && Array.isArray(pool.female) && pool.female.length > 0 && Array.isArray(pool.surnames) && pool.surnames.length > 0;
const loadNamePools = async () => {
  try {
    const response = await fetch(NAME_POOL_PATH, { cache: 'no-store' });
    if (!response.ok) throw new Error('이름 풀 로드 실패');
    const parsed = await response.json();
    const valid = RACE_POOL.every((raceInfo) => isValidRaceNamePool(parsed[raceInfo.key]));
    if (valid) namePools = parsed;
  } catch (error) {
    console.warn('[npc_test] 이름 풀 로드 실패, fallback 사용.', error);
  }
};

const bindEvents = () => {
  navTabs.forEach((tab) => tab.addEventListener('click', () => activateScreen(tab.dataset.screen)));

  npcSearchInput.addEventListener('input', () => {
    currentSearch = npcSearchInput.value.trim();
    renderNpcGalaxy();
  });

  npcSearchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const query = npcSearchInput.value.trim().toLowerCase();
    if (!query) return;
    const match = npcList.find((npc) => displayNpcName(npc).toLowerCase().includes(query));
    if (!match) return;
    npcGalaxy.classList.add('is-spinning');
    setTimeout(() => {
      npcGalaxy.classList.remove('is-spinning');
      openNpcProfile(match);
    }, 850);
  });

  raceFilter.addEventListener('change', () => {
    currentRaceFilter = raceFilter.value;
    renderNpcGalaxy();
  });

  compareNpcA.addEventListener('change', () => {
    selectedA = compareNpcA.value ? Number(compareNpcA.value) : null;
    syncCompatibilityPanel();
  });

  compareNpcB.addEventListener('change', () => {
    selectedB = compareNpcB.value ? Number(compareNpcB.value) : null;
    syncCompatibilityPanel();
  });

  profileTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      activateProfileTab(tab.dataset.profileTab);
      const idMatch = profileName.textContent.match(/#(\d+)\)/);
      if (!idMatch) return;
      const npc = findNpcById(Number(idMatch[1]));
      if (npc) openNpcProfile(npc);
    });
  });
};

const bootstrap = async () => {
  await loadNamePools();
  initMainActionDeck();
  bindEvents();
  regenerateNpcList();
  activateScreen('observatory');
};

bootstrap();
