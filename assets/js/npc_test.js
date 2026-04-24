const NPC_COUNT = 100;
const NAME_POOL_PATH = './assets/data/npc_name_pools.json';

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
const TRAIT_POOL = ['전술 감각', '사교성', '야간 시야', '수렵 본능', '기계 수리', '약초 지식', '재봉 기술', '연설 능력', '화염 저항', '지형 파악'];
const STAT_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

const generateButton = document.getElementById('generateNpcList');
const sortByAgeButton = document.getElementById('sortByAge');
const sortByNameButton = document.getElementById('sortByName');
const npcListElement = document.getElementById('npcList');
const npcSummaryElement = document.getElementById('npcSummary');
const npcDetailDialog = document.getElementById('npcDetailDialog');
const dialogNpcName = document.getElementById('dialogNpcName');
const dialogNpcMeta = document.getElementById('dialogNpcMeta');
const dialogNpcDetail = document.getElementById('dialogNpcDetail');
const radarChart = document.getElementById('npcRadarChart');
const npcContextList = document.getElementById('npcContextList');

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
let npcIndexes = {
  byId: new Map(),
  byRace: new Map(),
  byFamily: new Map(),
  byTrait: new Map()
};

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickOne = (pool) => pool[randomInt(0, pool.length - 1)];

const createUniqueSeedGenerator = () => {
  const usedSeeds = new Set();

  return () => {
    // 10자리 숫자 문자열을 랜덤 생성하고 중복을 방지한다.
    while (true) {
      const seed = String(randomInt(1_000_000_000, 9_999_999_999));
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
      childrenIds: []
    },
    traits: {
      acquired: [pickOne(TRAIT_POOL), pickOne(TRAIT_POOL)]
    }
  };
};

const canBeParent = (npc, child, minParentAgeGap) => npc.race === child.race && npc.age - child.age >= minParentAgeGap;

const canBeSpousePair = (left, right) => {
  // 성인/동일 종족/서로 미혼/적당한 나이 차 조건을 기본으로 한다.
  if (!left || !right || left.id === right.id) return false;
  if (left.race !== right.race) return false;
  if (left.gender === right.gender) return false;
  if (left.age < 18 || right.age < 18) return false;
  if (left.familyLinks.spouseId || right.familyLinks.spouseId) return false;
  return Math.abs(left.age - right.age) <= 24;
};

const assignSpouseLinks = (list) => {
  const byRace = new Map();
  list.forEach((npc) => {
    if (!byRace.has(npc.race)) byRace.set(npc.race, []);
    byRace.get(npc.race).push(npc);
  });

  byRace.forEach((raceMembers) => {
    const males = raceMembers
      .filter((npc) => npc.gender === '남성' && npc.age >= 18)
      .sort(() => Math.random() - 0.5);
    const females = raceMembers
      .filter((npc) => npc.gender === '여성' && npc.age >= 18)
      .sort(() => Math.random() - 0.5);

    males.forEach((male) => {
      if (male.familyLinks.spouseId) return;
      const partner = females.find((female) => canBeSpousePair(male, female));
      if (!partner) return;
      // 전체가 커플로 묶이지 않도록 확률 조건을 둔다.
      if (Math.random() >= 0.58) return;
      male.familyLinks.spouseId = partner.id;
      partner.familyLinks.spouseId = male.id;
      // 예외 규칙: 여성은 결혼 후 배우자(남성)의 가문으로만 편입한다. (성씨는 유지)
      partner.familyId = male.familyId;
    });
  });
};

const assignFamilyLinks = (list) => {
  const byRace = new Map();
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
    }
  });
};

const displayNpcName = (npc) => npc?.name?.full || '이름 없음';

const rebuildIndexes = () => {
  npcIndexes = {
    byId: new Map(),
    byRace: new Map(),
    byFamily: new Map(),
    byTrait: new Map()
  };

  npcList.forEach((npc) => {
    npcIndexes.byId.set(npc.id, npc);

    if (!npcIndexes.byRace.has(npc.race)) npcIndexes.byRace.set(npc.race, []);
    npcIndexes.byRace.get(npc.race).push(npc.id);

    if (!npcIndexes.byFamily.has(npc.familyId)) npcIndexes.byFamily.set(npc.familyId, []);
    npcIndexes.byFamily.get(npc.familyId).push(npc.id);

    npc.traits.acquired.forEach((trait) => {
      if (!npcIndexes.byTrait.has(trait)) npcIndexes.byTrait.set(trait, []);
      npcIndexes.byTrait.get(trait).push(npc.id);
    });
  });
};

const findNpcById = (id) => npcIndexes.byId.get(id);

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

const openNpcDialog = (npc) => {
  dialogNpcName.textContent = `${displayNpcName(npc)} (#${npc.id})`;
  const familyName = getFamilyName(npc);
  dialogNpcMeta.textContent = `${npc.race} · ${npc.gender} · ${npc.age}세 · ${familyName}`;

  renderRadarChart(npc.stats);

  const detailRows = [
    ['고유 시드', npc.uniqueSeed],
    ['배우 ID', npc.actorId],
    ['종족', createObjectButton(npc.race, () => renderContextPanel(`종족: ${npc.race}`, npcIndexes.byRace.get(npc.race) || []))],
    ['가문', createObjectButton(familyName, () => renderContextPanel(`가문: ${familyName}`, npcIndexes.byFamily.get(npc.familyId) || []))],
    ['배우자', npc.familyLinks.spouseId ? createRelativeListFragment([npc.familyLinks.spouseId]) : '없음'],
    ['아버지', npc.familyLinks.fatherId ? createRelativeListFragment([npc.familyLinks.fatherId]) : '없음'],
    ['어머니', npc.familyLinks.motherId ? createRelativeListFragment([npc.familyLinks.motherId]) : '없음'],
    ['자녀', createRelativeListFragment(npc.familyLinks.childrenIds)],
    ['후천 특성', (() => {
      const frag = document.createDocumentFragment();
      npc.traits.acquired.forEach((trait, index) => {
        frag.append(createObjectButton(trait, () => renderContextPanel(`특성: ${trait}`, npcIndexes.byTrait.get(trait) || [])));
        if (index < npc.traits.acquired.length - 1) frag.append(document.createTextNode(' '));
      });
      return frag;
    })()]
  ];

  dialogNpcDetail.replaceChildren(
    ...detailRows.map(([label, value]) => {
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
      relation.textContent = `배우자 ${spouse} / 부모 연결 ${parents} / 자녀 ${children}`;

      card.append(nameButton, meta, relation);
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
  assignSpouseLinks(npcList);
  assignFamilyLinks(npcList);
  rebuildIndexes();
  buildSummary();
  renderNpcList();
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
  regenerateNpcList();
  bindEvents();
};

bootstrap();
