const NPC_COUNT = 100;

const RACE_POOL = [
  { name: '인간', adultAge: 18, elderAge: 60, maxAge: 85 },
  { name: '엘프', adultAge: 30, elderAge: 180, maxAge: 320 },
  { name: '드워프', adultAge: 24, elderAge: 120, maxAge: 210 },
  { name: '하플링', adultAge: 20, elderAge: 80, maxAge: 130 }
];

const FAMILY_POOL = ['000가문', '101가문', '203가문', '317가문', '404가문', '511가문', '622가문'];
const SURNAME_POOL = ['하이스', '로웬', '벨란', '트리아', '에단', '모르', '실피', '카딘'];
const GIVEN_NAME_POOL = ['리아', '이안', '로아', '카엘', '니르', '아렌', '실라', '테오', '미라', '루벤', '다엘', '하린'];
const TRAIT_POOL = ['전술 감각', '사교성', '야간 시야', '수렵 본능', '기계 수리', '약초 지식', '재봉 기술', '연설 능력'];

const generateButton = document.getElementById('generateNpcList');
const sortByAgeButton = document.getElementById('sortByAge');
const sortByNameButton = document.getElementById('sortByName');
const npcListElement = document.getElementById('npcList');
const npcSummaryElement = document.getElementById('npcSummary');
const npcDetailDialog = document.getElementById('npcDetailDialog');
const dialogNpcName = document.getElementById('dialogNpcName');
const dialogNpcMeta = document.getElementById('dialogNpcMeta');
const dialogNpcDetail = document.getElementById('dialogNpcDetail');

let npcList = [];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickOne = (pool) => pool[randomInt(0, pool.length - 1)];

const createAgeForRace = (raceInfo) => {
  // 종족 수명대를 고려해 청년/장년/노년 분포를 적당히 섞는다.
  const dice = Math.random();
  if (dice < 0.15) return randomInt(0, raceInfo.adultAge - 1);
  if (dice < 0.8) return randomInt(raceInfo.adultAge, raceInfo.elderAge - 1);
  return randomInt(raceInfo.elderAge, raceInfo.maxAge);
};

const createNpcBase = (id) => {
  const raceInfo = pickOne(RACE_POOL);
  const gender = Math.random() < 0.5 ? '남성' : '여성';
  const surname = pickOne(SURNAME_POOL);
  const givenName = pickOne(GIVEN_NAME_POOL);
  const age = createAgeForRace(raceInfo);

  return {
    id,
    actorId: `random_npc_${String(id).padStart(3, '0')}`,
    uniqueSeed: String(1_100_000_000 + id),
    role: 'npc',
    family: pickOne(FAMILY_POOL),
    surname,
    givenName,
    name: `${surname} ${givenName}`,
    gender,
    age,
    race: raceInfo.name,
    raceRule: '부모 종족 동일 계승',
    familyLinks: {
      fatherId: null,
      motherId: null,
      childrenIds: []
    },
    traits: {
      acquired: [pickOne(TRAIT_POOL), pickOne(TRAIT_POOL)]
    }
  };
};

const canBeParent = (npc, child, minParentAgeGap) => {
  // 같은 종족이면서 부모가 될 수 있는 최소 나이 차이를 만족해야 한다.
  return npc.race === child.race && npc.age - child.age >= minParentAgeGap;
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
      child.family = father.family;
      child.surname = father.surname;
      child.name = `${child.surname} ${child.givenName}`;
    }

    if (motherCandidates.length > 0 && Math.random() < 0.68) {
      const mother = pickOne(motherCandidates);
      child.familyLinks.motherId = mother.id;
      mother.familyLinks.childrenIds.push(child.id);

      // 부계 정보가 비어 있으면 모계 성을 임시 반영한다.
      if (!child.familyLinks.fatherId) {
        child.family = mother.family;
        child.surname = mother.surname;
        child.name = `${child.surname} ${child.givenName}`;
      }
    }
  });
};

const findNpcById = (id) => npcList.find((npc) => npc.id === id);

const formatRelativeName = (id, fallback) => {
  if (!id) return '없음';
  const npc = findNpcById(id);
  return npc ? `${npc.name} (#${npc.id})` : fallback;
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
};

const openNpcDialog = (npc) => {
  dialogNpcName.textContent = `${npc.name} (#${npc.id})`;
  dialogNpcMeta.textContent = `${npc.race} · ${npc.gender} · ${npc.age}세 · ${npc.family}`;

  const detailRows = [
    ['고유 시드', npc.uniqueSeed],
    ['배우 ID', npc.actorId],
    ['종족 계승 규칙', npc.raceRule],
    ['아버지', formatRelativeName(npc.familyLinks.fatherId, `ID ${npc.familyLinks.fatherId}`)],
    ['어머니', formatRelativeName(npc.familyLinks.motherId, `ID ${npc.familyLinks.motherId}`)],
    ['자녀', npc.familyLinks.childrenIds.length ? npc.familyLinks.childrenIds.map((id) => formatRelativeName(id, `ID ${id}`)).join(', ') : '없음'],
    ['후천 특성', npc.traits.acquired.join(', ')]
  ];

  dialogNpcDetail.replaceChildren(
    ...detailRows.map(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'npc-dialog__row';

      const dt = document.createElement('dt');
      dt.textContent = label;

      const dd = document.createElement('dd');
      dd.textContent = value;

      row.append(dt, dd);
      return row;
    })
  );

  npcDetailDialog.showModal();
};

const renderNpcList = () => {
  npcListElement.replaceChildren(
    ...npcList.map((npc) => {
      const card = document.createElement('li');
      card.className = 'npc-item';
      card.tabIndex = 0;
      card.role = 'button';
      card.setAttribute('aria-label', `${npc.name} 상세 정보 보기`);

      const parents = [npc.familyLinks.fatherId, npc.familyLinks.motherId].filter(Boolean).length;
      const children = npc.familyLinks.childrenIds.length;

      card.innerHTML = `
        <p class="npc-item__name">${npc.name}</p>
        <p class="npc-item__meta">#${npc.id} · ${npc.race} · ${npc.age}세</p>
        <p class="npc-item__relation">부모 연결 ${parents} / 자녀 ${children}</p>
      `;

      const openDialog = () => openNpcDialog(npc);
      card.addEventListener('click', openDialog);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openDialog();
        }
      });

      return card;
    })
  );
};

const regenerateNpcList = () => {
  // 기존 데이터는 완전히 폐기하고 매번 100명을 새로 생성한다.
  npcList = Array.from({ length: NPC_COUNT }, (_, index) => createNpcBase(index + 1));
  assignFamilyLinks(npcList);
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
    npcList.sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
    renderNpcList();
  });
};

regenerateNpcList();
bindEvents();
