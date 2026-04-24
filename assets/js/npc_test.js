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

const TRAIT_BY_ID = new Map(TRAIT_CATALOG.map((trait) => [trait.id, trait]));
const FAMILY_NAME_BY_ID = new Map();

const DEFAULT_NAME_POOLS = {
  human: { male: ['리처드', '윌리엄', '에드워드', '토마스', '로버트'], female: ['메리', '제인', '엘리자베스', '아멜리아', '캐서린'], surnames: ['스미스', '윈저', '랭커스터', '튜더', '브루스'] },
  elf: { male: ['파엔다르', '엘라리안', '실리온', '갈라디르', '레놀라스'], female: ['아라엘', '리리엔', '니무에', '베스퍼', '티란디아'], surnames: ['윈드러너', '실버리프', '스타폴', '문위스퍼', '선스트라이더'] },
  dwarf: { male: ['소림', '코르바도르', '바인', '그롬나르', '타르간'], female: ['헬가', '다이나', '브룬힐다', '디스', '모이라'], surnames: ['스톤해머', '아이언포지', '브론즈비어드', '락크러셔', '실버베인'] },
  dragonborn: { male: ['드라가르', '록사르', '발라사', '아르잔', '토린바르'], female: ['크리나', '파리데', '소라', '젤렌', '다라'], surnames: ['아이언스케일', '플레임텅', '블러드혼', '레드팽', '드래곤베인'] }
};

const $ = (id) => document.getElementById(id);
const generateButton = $('generateNpcList');
const sortByAgeButton = $('sortByAge');
const sortByNameButton = $('sortByName');
const openCompareDialogButton = $('openCompareDialog');
const npcListElement = $('npcList');
const npcSummaryElement = $('npcSummary');
const npcDetailDialog = $('npcDetailDialog');
const dialogNpcName = $('dialogNpcName');
const dialogNpcMeta = $('dialogNpcMeta');
const dialogNpcDetail = $('dialogNpcDetail');
const radarChart = $('npcRadarChart');
const npcContextList = $('npcContextList');
const comparePreviewPair = $('comparePreviewPair');
const comparePreviewBar = $('comparePreviewBar');
const comparePreviewScore = $('comparePreviewScore');
const npcCompareDialog = $('npcCompareDialog');
const compareNpcASelect = $('compareNpcA');
const compareNpcBSelect = $('compareNpcB');
const compareDialogBar = $('compareDialogBar');
const compareDialogScore = $('compareDialogScore');
const compareDialogMeta = $('compareDialogMeta');
const traitDetailDialog = $('traitDetailDialog');
const traitDialogTitle = $('traitDialogTitle');
const traitDialogBody = $('traitDialogBody');
const npcActionDeck = $('npcActionDeck');
const familyTreeDialog = $('familyTreeDialog');
const familyTreeTitle = $('familyTreeTitle');
const familyTreeRoot = $('familyTreeRoot');

const tabButtons = Array.from(document.querySelectorAll('.main-tab'));
const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));
const detailTabs = Array.from(document.querySelectorAll('.detail-tab'));

let npcList = [];
let namePools = DEFAULT_NAME_POOLS;
let compareSelection = { leftId: null, rightId: null };
let activeDetailTab = 'overview';
let actionDeckBehavior = null;
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
const isSeedChecksumValid = (seed) => /^\d{10}$/.test(String(seed || '')) && computeSeedChecksum(String(seed).slice(0, 9)) === Number(String(seed).slice(9));

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

const activateTab = (tabKey) => {
  tabButtons.forEach((b) => b.classList.toggle('is-active', b.dataset.tabTarget === tabKey));
  tabPanels.forEach((p) => p.classList.toggle('is-active', p.dataset.tabPanel === tabKey));
};
const activateDetailTab = (tabKey) => {
  activeDetailTab = tabKey;
  detailTabs.forEach((b) => b.classList.toggle('is-active', b.dataset.detailTab === tabKey));
};

const createObjectButton = (label, onClick, className = 'obj-link') => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', (event) => { event.stopPropagation(); onClick(); });
  return button;
};

const createContextItem = (npcId) => {
  const li = document.createElement('li');
  const npc = findNpcById(npcId);
  if (!npc) { li.textContent = `ID ${npcId}`; return li; }
  li.append(createObjectButton(`${displayNpcName(npc)} · ${npc.race} · ${npc.age}세`, () => openNpcDialog(npc)));
  return li;
};

const renderContextPanel = (title, ids) => {
  npcContextList.replaceChildren();
  const head = document.createElement('li');
  head.textContent = `${title} · ${ids?.length || 0}명`;
  npcContextList.append(head);
  if (!ids || ids.length === 0) return;
  npcContextList.append(...ids.slice(0, 30).map(createContextItem));
  activateTab('context');
};

const renderComparePreview = () => {
  const left = findNpcById(compareSelection.leftId);
  const right = findNpcById(compareSelection.rightId);
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
  const optionsHtml = npcList.map((npc) => `<option value="${npc.id}">${displayNpcName(npc)} · ${npc.race} · ${npc.age}세</option>`).join('');
  compareNpcASelect.innerHTML = `<option value="">선택 안함</option>${optionsHtml}`;
  compareNpcBSelect.innerHTML = `<option value="">선택 안함</option>${optionsHtml}`;
};

const syncCompareDialogSelection = () => {
  compareNpcASelect.value = compareSelection.leftId ? String(compareSelection.leftId) : '';
  compareNpcBSelect.value = compareSelection.rightId ? String(compareSelection.rightId) : '';
  const left = findNpcById(compareSelection.leftId);
  const right = findNpcById(compareSelection.rightId);
  if (!left || !right) {
    compareDialogBar.style.width = '0%';
    compareDialogScore.textContent = '점수: 없음';
    compareDialogMeta.textContent = '두 NPC를 선택하면 결과가 표시됩니다.';
    return;
  }
  const score = calculateSeedCompatibilityPercent(left, right);
  compareDialogBar.style.width = `${score}%`;
  compareDialogScore.textContent = `점수: ${score}%`;
  compareDialogMeta.textContent = `${displayNpcName(left)} ↔ ${displayNpcName(right)} · 시드 토러스 거리 기반`;
};

const buildSummary = () => {
  const raceCount = npcList.reduce((acc, npc) => (acc.set(npc.race, (acc.get(npc.race) || 0) + 1), acc), new Map());
  const linkedChildren = npcList.filter((npc) => npc.familyLinks.fatherId || npc.familyLinks.motherId).length;
  const pills = Array.from(raceCount.entries()).map(([race, count]) => `<button class="chip" type="button" data-race="${race}">${race} ${count}명</button>`).join('');
  npcSummaryElement.innerHTML = `
    <p>총 <strong>${npcList.length}명</strong> 생성</p>
    <p>부모 연결 완료: <strong>${linkedChildren}명</strong></p>
    <div class="chips">${pills}</div>
  `;
  npcSummaryElement.querySelectorAll('[data-race]').forEach((button) => {
    button.addEventListener('click', () => renderContextPanel(`종족: ${button.dataset.race}`, npcIndexes.byRace.get(button.dataset.race) || []));
  });
};

const pointOnCircle = (cx, cy, radius, angle) => ({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });

const renderRadarChart = (stats) => {
  radarChart.replaceChildren();
  const centerX = 130; const centerY = 130; const maxRadius = 90; const levelCount = 5;
  const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const axisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

  for (let level = 1; level <= levelCount; level += 1) {
    const r = (maxRadius / levelCount) * level;
    const points = STAT_KEYS.map((_, index) => {
      const p = pointOnCircle(centerX, centerY, r, (-Math.PI / 2) + (Math.PI * 2 * index) / STAT_KEYS.length);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    }).join(' ');
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', points); polygon.setAttribute('class', 'npc-radar__grid'); gridGroup.appendChild(polygon);
  }

  STAT_KEYS.forEach((key, index) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / STAT_KEYS.length;
    const outer = pointOnCircle(centerX, centerY, maxRadius, angle);
    const axis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axis.setAttribute('x1', String(centerX)); axis.setAttribute('y1', String(centerY)); axis.setAttribute('x2', String(outer.x)); axis.setAttribute('y2', String(outer.y)); axis.setAttribute('class', 'npc-radar__axis');
    axisGroup.appendChild(axis);

    const labelP = pointOnCircle(centerX, centerY, maxRadius + 18, angle);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', labelP.x.toFixed(2)); label.setAttribute('y', labelP.y.toFixed(2)); label.setAttribute('text-anchor', 'middle'); label.setAttribute('dominant-baseline', 'middle'); label.setAttribute('class', 'npc-radar__label');
    label.textContent = `${key} ${stats[key]}`;
    labelGroup.appendChild(label);
  });

  const statPoints = STAT_KEYS.map((key, index) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / STAT_KEYS.length;
    const p = pointOnCircle(centerX, centerY, maxRadius * (Math.min(20, Math.max(0, stats[key])) / 20), angle);
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }).join(' ');

  const statPolygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  statPolygon.setAttribute('points', statPoints);
  statPolygon.setAttribute('class', 'npc-radar__value');
  radarChart.append(gridGroup, axisGroup, statPolygon, labelGroup);
  radarChart.classList.remove('npc-radar--animate');
  requestAnimationFrame(() => radarChart.classList.add('npc-radar--animate'));
};

const openTraitDialog = (traitId) => {
  const trait = TRAIT_BY_ID.get(traitId);
  if (!trait) return;
  // 요청사항: 목록에는 이름만 노출하고, 상세/메타는 팝업에서만 제공한다.
  traitDialogTitle.textContent = `특성: ${trait.name}`;
  traitDialogBody.innerHTML = `
    <article class="row"><dt>설명</dt><dd>${trait.description}</dd></article>
    <article class="row"><dt>메타 한줄평</dt><dd>${traitMetaReviewOf(traitId)}</dd></article>
    <article class="row"><dt>메타 정보</dt><dd>${trait.type} · ${trait.rarity} · ID ${trait.id}</dd></article>
  `;
  if (!traitDetailDialog.open) traitDetailDialog.showModal();
};

const buildFamilyTreeNode = (npcId, depth, visited, maxDepth) => {
  const li = document.createElement('li');
  const npc = findNpcById(npcId);
  if (!npc) { li.textContent = `알 수 없는 구성원 #${npcId}`; return li; }

  const node = createObjectButton(`${displayNpcName(npc)} · ${npc.age}세`, () => openNpcDialog(npc), `family-node ${depth === 0 ? 'root' : ''}`);
  li.append(node);
  if (depth >= maxDepth || visited.has(npcId)) return li;

  const relatives = [npc.familyLinks.fatherId, npc.familyLinks.motherId, ...(npc.familyLinks.childrenIds || [])].filter(Boolean);
  if (relatives.length) {
    visited.add(npcId);
    const ul = document.createElement('ul');
    relatives.forEach((id) => ul.append(buildFamilyTreeNode(id, depth + 1, new Set(visited), maxDepth)));
    li.append(ul);
  }
  return li;
};

const openFamilyTreeDialog = (rootNpc) => {
  familyTreeTitle.textContent = `가문 패밀리 트리: ${getFamilyName(rootNpc)}`;
  familyTreeRoot.replaceChildren();
  const wrapper = document.createElement('ul');
  wrapper.append(buildFamilyTreeNode(rootNpc.id, 0, new Set(), 4));
  familyTreeRoot.append(wrapper);
  if (!familyTreeDialog.open) familyTreeDialog.showModal();
};

const createRelativeListFragment = (ids) => {
  const fragment = document.createDocumentFragment();
  if (!ids || ids.length === 0) return document.createTextNode('없음');
  ids.forEach((id, index) => {
    const npc = findNpcById(id);
    fragment.append(createObjectButton(npc ? `${displayNpcName(npc)} (#${id})` : `ID ${id}`, () => npc && openNpcDialog(npc)));
    if (index < ids.length - 1) fragment.append(document.createTextNode(' '));
  });
  return fragment;
};

const openNpcDialog = (npc) => {
  dialogNpcName.textContent = `${displayNpcName(npc)} (#${npc.id})`;
  dialogNpcMeta.textContent = `${npc.race} · ${npc.gender} · ${npc.age}세 · ${getFamilyName(npc)}`;
  renderRadarChart(npc.stats);

  const rows = [
    ['고유 시드', `${npc.uniqueSeed}${isSeedChecksumValid(npc.uniqueSeed) ? '' : ' (체크섬 경고)'}`],
    ['배우 ID', npc.actorId],
    ['종족', createObjectButton(npc.race, () => renderContextPanel(`종족: ${npc.race}`, npcIndexes.byRace.get(npc.race) || []))],
    ['가문', (() => {
      const f = document.createDocumentFragment();
      f.append(createObjectButton(getFamilyName(npc), () => renderContextPanel(`가문: ${getFamilyName(npc)}`, npcIndexes.byFamily.get(npc.familyId) || [])));
      f.append(document.createTextNode(' '));
      f.append(createObjectButton('패밀리 트리', () => openFamilyTreeDialog(npc)));
      return f;
    })()],
    ['배우자', npc.familyLinks.spouseId ? createRelativeListFragment([npc.familyLinks.spouseId]) : '없음'],
    ['속궁합(시드 기반)', (() => {
      const spouse = npc.familyLinks.spouseId ? findNpcById(npc.familyLinks.spouseId) : null;
      const score = calculateSeedCompatibilityPercent(npc, spouse);
      return score == null ? '없음' : `${score}%`;
    })()],
    ['연문 관계', createRelativeListFragment(npc.familyLinks.affairPartnerIds || [])],
    ['아버지', npc.familyLinks.fatherId ? createRelativeListFragment([npc.familyLinks.fatherId]) : '없음'],
    ['어머니', npc.familyLinks.motherId ? createRelativeListFragment([npc.familyLinks.motherId]) : '없음'],
    ['자녀', createRelativeListFragment(npc.familyLinks.childrenIds || [])],
    ['후천 특성', (() => {
      const f = document.createDocumentFragment();
      (npc.traits.acquiredTraitIds || []).forEach((traitId, i) => {
        f.append(createObjectButton(traitNameOf(traitId), () => openTraitDialog(traitId)));
        f.append(document.createTextNode(' '));
        f.append(createObjectButton('관련 NPC', () => renderContextPanel(`특성: ${traitNameOf(traitId)}`, npcIndexes.byTrait.get(traitId) || [])));
        if (i < (npc.traits.acquiredTraitIds.length - 1)) f.append(document.createTextNode(' '));
      });
      return f;
    })()]
  ];

  const visibleRowsByTab = {
    overview: ['고유 시드', '배우 ID', '종족', '가문', '속궁합(시드 기반)'],
    relation: ['배우자', '연문 관계', '아버지', '어머니', '자녀'],
    traits: ['후천 특성']
  };
  const visibleSet = new Set(visibleRowsByTab[activeDetailTab] || visibleRowsByTab.overview);

  dialogNpcDetail.replaceChildren(...rows.filter(([label]) => visibleSet.has(label)).map(([label, value]) => {
    const row = document.createElement('div'); row.className = 'row';
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd');
    if (typeof value === 'string') dd.textContent = value; else dd.append(value);
    row.append(dt, dd); return row;
  }));

  if (!npcDetailDialog.open) npcDetailDialog.showModal();
};

const renderNpcList = () => {
  npcListElement.replaceChildren(...npcList.map((npc) => {
    const card = document.createElement('li');
    card.className = 'card'; card.tabIndex = 0; card.role = 'button';

    const nameBtn = document.createElement('button');
    nameBtn.type = 'button'; nameBtn.className = 'card__name'; nameBtn.textContent = displayNpcName(npc);
    nameBtn.addEventListener('click', (event) => { event.stopPropagation(); openNpcDialog(npc); });

    const meta = document.createElement('p');
    meta.className = 'card__meta'; meta.textContent = `#${npc.id} · ${npc.race} · ${npc.age}세`;

    const relation = document.createElement('p');
    relation.className = 'card__sub';
    relation.textContent = `배우자 ${npc.familyLinks.spouseId ? 1 : 0} / 연문 ${(npc.familyLinks.affairPartnerIds || []).length} / 자녀 ${npc.familyLinks.childrenIds.length}`;

    // 요청사항: 특성은 이름만 카드에 보여주고 상세 설명은 팝업으로 분리.
    const chips = document.createElement('div'); chips.className = 'chips';
    (npc.traits.acquiredTraitIds || []).forEach((traitId) => {
      const chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'chip'; chip.textContent = traitNameOf(traitId);
      chip.addEventListener('click', (event) => { event.stopPropagation(); openTraitDialog(traitId); });
      chips.append(chip);
    });

    const actionRow = document.createElement('div'); actionRow.className = 'card__actions';
    const left = createObjectButton('비교 A', () => { compareSelection.leftId = npc.id; renderComparePreview(); syncCompareDialogSelection(); activateTab('compat'); }, 'card__mini');
    const right = createObjectButton('비교 B', () => { compareSelection.rightId = npc.id; renderComparePreview(); syncCompareDialogSelection(); activateTab('compat'); }, 'card__mini');
    const family = createObjectButton('가문 트리', () => openFamilyTreeDialog(npc), 'card__mini');
    actionRow.append(left, right, family);

    card.append(nameBtn, meta, relation, chips, actionRow);
    card.addEventListener('click', () => openNpcDialog(npc));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openNpcDialog(npc); }
    });
    return card;
  }));
};

const initActionDeck = () => {
  const cardApi = window.NewtheriaCardTemplates;
  if (!cardApi || !npcActionDeck) return;
  const cards = cardApi.renderCardFanCards(npcActionDeck, [
    { route: 'reroll', icon: '🎲', label: '월드 리롤', desc: 'NPC 월드를 새로 생성' },
    { route: 'sort_age', icon: '📈', label: '나이순 정렬', desc: '최고령부터 정렬' },
    { route: 'sort_name', icon: '🔤', label: '이름순 정렬', desc: '한글 로케일 정렬' },
    { route: 'compare', icon: '💞', label: '속궁합 팝업', desc: '두 캐릭터 궁합 계산' }
  ]);
  actionDeckBehavior?.destroy?.();
  actionDeckBehavior = cardApi.createCardFanBehavior({ menu: npcActionDeck, cards });
  actionDeckBehavior.layoutCards();
  actionDeckBehavior.bindInteractions({
    onCardSelected: (card) => {
      const route = card?.dataset?.route;
      if (route === 'reroll') regenerateNpcList();
      if (route === 'sort_age') { npcList.sort((a, b) => b.age - a.age); renderNpcList(); }
      if (route === 'sort_name') { npcList.sort((a, b) => displayNpcName(a).localeCompare(displayNpcName(b), 'ko-KR')); renderNpcList(); }
      if (route === 'compare') { syncCompareDialogSelection(); if (!npcCompareDialog.open) npcCompareDialog.showModal(); }
      cardApi.setActiveCard(cards, card);
    }
  });
};

const regenerateNpcList = () => {
  const createSeed = createUniqueSeedGenerator();
  npcList = Array.from({ length: NPC_COUNT }, (_, index) => createNpcBase(index + 1, createSeed));
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

const isValidRaceNamePool = (pool) => pool && Array.isArray(pool.male) && pool.male.length > 0 && Array.isArray(pool.female) && pool.female.length > 0 && Array.isArray(pool.surnames) && pool.surnames.length > 0;
const loadNamePools = async () => {
  try {
    const response = await fetch(NAME_POOL_PATH, { cache: 'no-store' });
    if (!response.ok) throw new Error('이름 풀 로드 실패');
    const parsed = await response.json();
    const hasEveryRacePool = RACE_POOL.every((raceInfo) => isValidRaceNamePool(parsed[raceInfo.key]));
    if (hasEveryRacePool) namePools = parsed;
  } catch (error) {
    console.warn('[npc_test] 이름 풀 로드 실패, fallback 사용.', error);
  }
};

const bindEvents = () => {
  generateButton.addEventListener('click', regenerateNpcList);
  sortByAgeButton.addEventListener('click', () => { npcList.sort((a, b) => b.age - a.age); renderNpcList(); });
  sortByNameButton.addEventListener('click', () => { npcList.sort((a, b) => displayNpcName(a).localeCompare(displayNpcName(b), 'ko-KR')); renderNpcList(); });
  openCompareDialogButton.addEventListener('click', () => { syncCompareDialogSelection(); if (!npcCompareDialog.open) npcCompareDialog.showModal(); });

  tabButtons.forEach((button) => button.addEventListener('click', () => activateTab(button.dataset.tabTarget)));
  detailTabs.forEach((button) => button.addEventListener('click', () => {
    activateDetailTab(button.dataset.detailTab);
    const currentNpcId = Number((dialogNpcName.textContent.match(/#(\d+)\)/) || [])[1]);
    if (currentNpcId) { const npc = findNpcById(currentNpcId); if (npc) openNpcDialog(npc); }
  }));

  compareNpcASelect.addEventListener('change', () => { compareSelection.leftId = compareNpcASelect.value ? Number(compareNpcASelect.value) : null; syncCompareDialogSelection(); renderComparePreview(); });
  compareNpcBSelect.addEventListener('change', () => { compareSelection.rightId = compareNpcBSelect.value ? Number(compareNpcBSelect.value) : null; syncCompareDialogSelection(); renderComparePreview(); });
};

const bootstrap = async () => {
  await loadNamePools();
  initActionDeck();
  regenerateNpcList();
  bindEvents();
  activateTab('summary');
};

bootstrap();
