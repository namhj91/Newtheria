const NPC_COUNT = 120;
const RACES = ['인간', '엘프', '드워프', '용인'];
const TRAIT_CATALOG = [
  { id: 101, name: '강인함', desc: '피로 누적이 느리고 지구력이 높다.', meta: '전열 유지에 유리' },
  { id: 102, name: '직관', desc: '변수 감지와 탐색 반응 속도가 빠르다.', meta: '탐색 이벤트 성공률 상승' },
  { id: 103, name: '카리스마', desc: '설득/지휘 관련 판정 보너스를 받는다.', meta: '협상·지휘 시너지' },
  { id: 104, name: '광기', desc: '극단적 선택을 선호하나 폭발력이 높다.', meta: '리스크/리턴 고점형' },
  { id: 105, name: '장인정신', desc: '제작/보강 결과가 안정적으로 높다.', meta: '장비 품질 향상' },
  { id: 106, name: '사교성', desc: '관계 형성 속도와 호감도 성장량이 높다.', meta: '호감도 빌드 핵심' },
  { id: 107, name: '냉정함', desc: '스트레스 상황에서 판단 편차가 작다.', meta: '장기전 안정성' },
  { id: 108, name: '집념', desc: '목표 고정 시 성취 효율이 크게 오른다.', meta: '보스 추적형 성향' }
];

const state = {
  npcs: [],
  selectedId: null,
  filterRace: '전체',
  filterFamily: '전체',
  query: '',
  activeTab: 'summary'
};

const $ = (id) => document.getElementById(id);

/** 10자리 시드 기반 점수 계산용 헬퍼 */
const seedToVec = (seed) => {
  const s = String(seed).padStart(10, '0');
  return [Number(s.slice(0, 3)), Number(s.slice(3, 6)), Number(s.slice(6, 9))];
};

/** 토러스 거리 기반 속궁합 점수: 값이 낮을수록 가까운 벡터 */
const intimacyScore = (aSeed, bSeed) => {
  const A = seedToVec(aSeed);
  const B = seedToVec(bSeed);
  const wrap = (d) => Math.min(d, 1000 - d);
  const dx = wrap(Math.abs(A[0] - B[0]));
  const dy = wrap(Math.abs(A[1] - B[1]));
  const dz = wrap(Math.abs(A[2] - B[2]));
  const dist = Math.hypot(dx, dy, dz);
  const maxDist = Math.hypot(500, 500, 500);
  return Math.round(100 * (1 - Math.pow(dist / maxDist, 1.2)));
};

/** 샘플 가문+캐릭터 생성: 리뉴얼 UI 동작 검증을 위한 테스트 데이터 */
function buildNpcWorld() {
  const surnames = ['아스트라', '벨로스', '칼리안', '드레이크', '엘디르', '페로스', '그란트', '하르빈'];
  const givens = ['리아', '레온', '노아', '세라', '카인', '유나', '라온', '테오', '하린', '루크', '에반', '시아'];
  const families = surnames.map((surname, i) => ({
    id: `F${i + 1}`,
    name: `${surname} 가문`
  }));

  const npcs = [];
  let id = 1;
  for (const family of families) {
    const familyMembers = Math.max(12, Math.floor(NPC_COUNT / families.length));
    const ancestorId = id;
    for (let i = 0; i < familyMembers; i += 1) {
      const race = RACES[(i + id) % RACES.length];
      const ageBase = i === 0 ? 72 : 18 + ((i * 7 + id) % 46);
      const gender = i % 2 === 0 ? '여성' : '남성';
      const given = givens[(i * 3 + id) % givens.length];
      const full = `${family.name.replace(' 가문', '')} ${given}`;
      const traits = Array.from(new Set([
        TRAIT_CATALOG[(id + i) % TRAIT_CATALOG.length].id,
        TRAIT_CATALOG[(id + i + 2) % TRAIT_CATALOG.length].id
      ]));
      npcs.push({
        id,
        uniqueSeed: String(1000000000 + Math.floor(Math.random() * 8999999999)),
        name: { surname: family.name.replace(' 가문', ''), given, full },
        familyId: family.id,
        family: family.name,
        race,
        gender,
        age: ageBase,
        heightCm: 152 + ((id * 11) % 42),
        weightKg: 45 + ((id * 7) % 43),
        alignment: ['질서', '중립', '혼돈'][id % 3],
        aspiration: ['영지 확장', '가문 번영', '비전 추구', '명예 회복'][id % 4],
        stats: {
          str: 8 + (id % 8), dex: 8 + ((id + 2) % 8), int: 8 + ((id + 4) % 8),
          wis: 8 + ((id + 6) % 8), cha: 8 + ((id + 1) % 8), vit: 8 + ((id + 3) % 8)
        },
        traits,
        relations: {
          ancestorId,
          fatherId: null,
          motherId: null,
          spouseId: null,
          childrenIds: []
        }
      });
      id += 1;
    }
  }

  // 부모/배우자/자녀 연결 생성
  const byFamily = new Map();
  for (const npc of npcs) {
    if (!byFamily.has(npc.familyId)) byFamily.set(npc.familyId, []);
    byFamily.get(npc.familyId).push(npc);
  }

  byFamily.forEach((members) => {
    members.sort((a, b) => b.age - a.age);
    members.forEach((child, i) => {
      if (i < 2) return;
      const father = members.find((m) => m.gender === '남성' && m.age - child.age >= 18);
      const mother = members.find((m) => m.gender === '여성' && m.age - child.age >= 16);
      if (father) { child.relations.fatherId = father.id; father.relations.childrenIds.push(child.id); }
      if (mother) { child.relations.motherId = mother.id; mother.relations.childrenIds.push(child.id); }
    });

    const males = members.filter((m) => m.gender === '남성' && m.age >= 20 && !m.relations.spouseId);
    const females = members.filter((m) => m.gender === '여성' && m.age >= 20 && !m.relations.spouseId);
    while (males.length && females.length) {
      const m = males.pop();
      const f = females.pop();
      if (Math.abs(m.age - f.age) <= 14) {
        m.relations.spouseId = f.id;
        f.relations.spouseId = m.id;
      }
    }
  });

  return npcs.slice(0, NPC_COUNT);
}

function traitInfo(id) {
  return TRAIT_CATALOG.find((t) => t.id === id);
}

function setup() {
  bindUI();
  rerollWorld();
}

function bindUI() {
  $('rerollBtn').addEventListener('click', rerollWorld);
  $('compareOpenBtn').addEventListener('click', () => $('compareModal').showModal());
  $('familyOpenBtn').addEventListener('click', () => $('familyModal').showModal());
  $('searchInput').addEventListener('input', (e) => { state.query = e.target.value.trim(); renderNpcList(); });
  $('raceFilter').addEventListener('change', (e) => { state.filterRace = e.target.value; renderNpcList(); });
  $('familyFilter').addEventListener('change', (e) => { state.filterFamily = e.target.value; renderNpcList(); });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.activeTab = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t === tab));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('is-active', p.dataset.panel === state.activeTab));
    });
  });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => $(btn.dataset.close).close());
  });

  $('compareA').addEventListener('change', renderCompareResult);
  $('compareB').addEventListener('change', renderCompareResult);
  $('familyFocusSelect').addEventListener('change', (e) => renderFamilyTree(Number(e.target.value), true));
}

function rerollWorld() {
  state.npcs = buildNpcWorld();
  state.selectedId = state.npcs[0]?.id || null;
  renderFilters();
  renderNpcList();
  renderSelected();
  renderCompareOptions();
  renderFamilyOptions();
  renderFamilyTree(state.selectedId, false);
}

function renderFilters() {
  const races = ['전체', ...RACES];
  $('raceFilter').innerHTML = races.map((r) => `<option value="${r}">${r}</option>`).join('');

  const families = ['전체', ...new Set(state.npcs.map((n) => n.family))];
  $('familyFilter').innerHTML = families.map((f) => `<option value="${f}">${f}</option>`).join('');
}

function filteredNpcs() {
  return state.npcs.filter((npc) => {
    const q = state.query.toLowerCase();
    const hitQuery = !q || `${npc.name.full} ${npc.family} ${npc.race}`.toLowerCase().includes(q);
    const hitRace = state.filterRace === '전체' || npc.race === state.filterRace;
    const hitFamily = state.filterFamily === '전체' || npc.family === state.filterFamily;
    return hitQuery && hitRace && hitFamily;
  });
}

function renderNpcList() {
  const list = filteredNpcs();
  $('npcCountMeta').textContent = `${list.length} / ${state.npcs.length}`;
  $('npcList').innerHTML = list.map((npc) => `
    <button class="npc-item ${npc.id === state.selectedId ? 'is-active' : ''}" data-id="${npc.id}">
      <strong>${npc.name.full}</strong>
      <small>${npc.family} · ${npc.race} · ${npc.age}세</small>
    </button>
  `).join('');

  document.querySelectorAll('.npc-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedId = Number(btn.dataset.id);
      renderNpcList();
      renderSelected();
      renderFamilyTree(state.selectedId, true);
    });

    btn.addEventListener('dblclick', () => openNpcModal(Number(btn.dataset.id)));
  });
}

function renderSelected() {
  const npc = state.npcs.find((n) => n.id === state.selectedId);
  if (!npc) return;

  $('selectedSummary').innerHTML = `
    <div class="summary-grid">
      <div class="summary-card"><strong>이름</strong><div>${npc.name.full}</div></div>
      <div class="summary-card"><strong>가문</strong><div><button type="button" data-family-focus="${npc.id}">${npc.family}</button></div></div>
      <div class="summary-card"><strong>종족/성별</strong><div>${npc.race} / ${npc.gender}</div></div>
      <div class="summary-card"><strong>나이/체격</strong><div>${npc.age}세 · ${npc.heightCm}cm · ${npc.weightKg}kg</div></div>
      <div class="summary-card"><strong>성향/숙원</strong><div>${npc.alignment} · ${npc.aspiration}</div></div>
      <div class="summary-card"><strong>빠른 액션</strong><div><button type="button" data-open-modal="${npc.id}">상세 팝업 열기</button></div></div>
    </div>
    <div style="margin-top:10px;"><strong>특성</strong><div>${npc.traits.map((id) => `<button class="trait-chip" type="button" data-trait="${id}">${traitInfo(id)?.name || id}</button>`).join('')}</div></div>
  `;

  renderCardPreview(npc);
  renderTimeline(npc);

  $('selectedSummary').querySelectorAll('[data-open-modal]').forEach((el) => el.addEventListener('click', () => openNpcModal(Number(el.dataset.openModal))));
  $('selectedSummary').querySelectorAll('[data-family-focus]').forEach((el) => el.addEventListener('click', () => {
    $('familyModal').showModal();
    $('familyFocusSelect').value = el.dataset.familyFocus;
    renderFamilyTree(Number(el.dataset.familyFocus), true);
  }));
  bindTraitClick($('selectedSummary'));
}

function renderCardPreview(centerNpc) {
  const pool = state.npcs.filter((n) => n.familyId === centerNpc.familyId).slice(0, 6);
  $('cardPreview').innerHTML = pool.map((npc) => `
    <button class="npc-card card-fan-card" type="button" data-open-modal="${npc.id}">
      <span class="card-fan-card-inner">
        <span class="card-fan-card-face card-fan-front">
          <span class="icon">🜂</span>
          <span class="label">${npc.name.full}</span>
          <span class="desc">${npc.race} · ${npc.age}세 · ${npc.family}</span>
        </span>
        <span class="card-fan-card-face card-fan-back">
          <span class="sigil">✦</span>
          <span class="brand">NEWTHERIA</span>
          <span class="orbit"></span>
        </span>
      </span>
    </button>
  `).join('');

  document.querySelectorAll('#cardPreview [data-open-modal]').forEach((btn) => {
    btn.addEventListener('click', () => openNpcModal(Number(btn.dataset.openModal)));
    btn.addEventListener('mouseenter', () => btn.classList.add('is-flipped'));
    btn.addEventListener('mouseleave', () => btn.classList.remove('is-flipped'));
  });
}

function renderTimeline(npc) {
  const items = [
    `${npc.name.full} 탄생 (${npc.age}년 전 추정)`,
    npc.relations.spouseId ? `${nameOf(npc.relations.spouseId)}와 혼인 관계` : '현재 배우자 정보 없음',
    npc.relations.childrenIds.length ? `자녀 ${npc.relations.childrenIds.length}명과 혈연 연결` : '등록된 자녀 정보 없음',
    `대표 숙원: ${npc.aspiration}`
  ];
  $('timelineList').innerHTML = items.map((v) => `<li>${v}</li>`).join('');
}

function nameOf(id) {
  return state.npcs.find((n) => n.id === id)?.name.full || `#${id}`;
}

function openNpcModal(id) {
  const npc = state.npcs.find((n) => n.id === id);
  if (!npc) return;

  $('npcModalTitle').textContent = `${npc.name.full} 상세 정보`;
  $('npcModalBody').innerHTML = `
    <section class="summary-grid">
      <article class="summary-card"><strong>기본</strong><div>${npc.family} · ${npc.race} · ${npc.gender}</div><div>${npc.age}세 / ${npc.heightCm}cm / ${npc.weightKg}kg</div></article>
      <article class="summary-card"><strong>고유 시드</strong><div>${npc.uniqueSeed}</div></article>
      <article class="summary-card"><strong>성향</strong><div>${npc.alignment}</div><div>${npc.aspiration}</div></article>
      <article class="summary-card"><strong>가문 이동</strong><div><button type="button" data-family-focus="${npc.id}">이 인물 기준 트리 보기</button></div></article>
    </section>

    <section style="margin-top:12px;">
      <h4>스탯</h4>
      <div class="summary-grid">
        ${Object.entries(npc.stats).map(([k,v]) => `<div class="summary-card">${k.toUpperCase()} : <strong>${v}</strong></div>`).join('')}
      </div>
    </section>

    <section style="margin-top:12px;">
      <h4>특성 (이름만 노출 · 클릭 시 메타 팝업)</h4>
      <div>${npc.traits.map((tid) => `<button class="trait-chip" type="button" data-trait="${tid}">${traitInfo(tid)?.name || tid}</button>`).join('')}</div>
    </section>

    <section style="margin-top:12px;">
      <h4>관계</h4>
      <ul>
        <li>부: ${npc.relations.fatherId ? `<button type="button" data-open-modal="${npc.relations.fatherId}">${nameOf(npc.relations.fatherId)}</button>` : '없음'}</li>
        <li>모: ${npc.relations.motherId ? `<button type="button" data-open-modal="${npc.relations.motherId}">${nameOf(npc.relations.motherId)}</button>` : '없음'}</li>
        <li>배우자: ${npc.relations.spouseId ? `<button type="button" data-open-modal="${npc.relations.spouseId}">${nameOf(npc.relations.spouseId)}</button>` : '없음'}</li>
        <li>자녀: ${npc.relations.childrenIds.length ? npc.relations.childrenIds.map((cid) => `<button type="button" data-open-modal="${cid}">${nameOf(cid)}</button>`).join(' ') : '없음'}</li>
      </ul>
    </section>
  `;

  bindTraitClick($('npcModalBody'));
  $('npcModalBody').querySelectorAll('[data-open-modal]').forEach((el) => el.addEventListener('click', () => openNpcModal(Number(el.dataset.openModal))));
  $('npcModalBody').querySelectorAll('[data-family-focus]').forEach((el) => el.addEventListener('click', () => {
    $('familyModal').showModal();
    $('familyFocusSelect').value = String(el.dataset.familyFocus);
    renderFamilyTree(Number(el.dataset.familyFocus), true);
  }));

  $('npcModal').showModal();
}

function bindTraitClick(root) {
  root.querySelectorAll('[data-trait]').forEach((el) => {
    el.addEventListener('click', () => {
      const info = traitInfo(Number(el.dataset.trait));
      $('traitModalTitle').textContent = info?.name || '특성';
      $('traitModalBody').innerHTML = `
        <p><strong>설명</strong><br>${info?.desc || '설명 없음'}</p>
        <p><strong>메타</strong><br>${info?.meta || '메타 정보 없음'}</p>
        <p><strong>ID</strong> ${info?.id ?? '-'}</p>
      `;
      $('traitModal').showModal();
    });
  });
}

function renderCompareOptions() {
  const options = state.npcs.map((n) => `<option value="${n.id}">${n.name.full} (${n.family})</option>`).join('');
  $('compareA').innerHTML = options;
  $('compareB').innerHTML = options;
  $('compareA').value = String(state.npcs[0]?.id || '');
  $('compareB').value = String(state.npcs[1]?.id || state.npcs[0]?.id || '');
  renderCompareResult();
}

function renderCompareResult() {
  const a = state.npcs.find((n) => n.id === Number($('compareA').value));
  const b = state.npcs.find((n) => n.id === Number($('compareB').value));
  if (!a || !b) return;
  const score = intimacyScore(a.uniqueSeed, b.uniqueSeed);
  const grade = score >= 80 ? 'S' : score >= 65 ? 'A' : score >= 45 ? 'B' : score >= 30 ? 'C' : 'D';
  $('compareResult').innerHTML = `
    <p>${a.name.full} × ${b.name.full}</p>
    <p><strong>${score}점 (${grade})</strong></p>
    <p>${score >= 70 ? '강한 공명. 장기 파티/혼인 시나리오에 유리합니다.' : score >= 45 ? '무난한 궁합. 상황/성향 보정에 따라 결과가 달라집니다.' : '충돌 가능성 높음. 리스크 관리가 필요합니다.'}</p>
  `;
}

function renderFamilyOptions() {
  $('familyFocusSelect').innerHTML = state.npcs.map((n) => `<option value="${n.id}">${n.name.full} · ${n.family}</option>`).join('');
  $('familyFocusSelect').value = String(state.selectedId || state.npcs[0]?.id || '');
}

/**
 * 패밀리 트리 렌더링
 * - 기준 인물을 누르면 해당 인물을 중심으로 같은 가문 계보를 다시 그림
 * - 전환 시 페이드/트랜슬레이트로 부드럽게 이동하는 체감 연출 제공
 */
function renderFamilyTree(focusId, animate) {
  const focus = state.npcs.find((n) => n.id === focusId);
  if (!focus) return;

  const treeEl = $('familyTree');
  if (animate) treeEl.classList.add('is-switching');

  const familyMembers = state.npcs.filter((n) => n.familyId === focus.familyId);
  const byId = new Map(familyMembers.map((n) => [n.id, n]));

  // 가장 위 조상 찾기: father/mother를 따라 올라가며 멈춘 지점
  let root = focus;
  while (root.relations.fatherId && byId.has(root.relations.fatherId)) {
    root = byId.get(root.relations.fatherId);
  }

  const levels = [];
  let current = [root.id];
  const visited = new Set();
  for (let depth = 0; depth < 5 && current.length; depth += 1) {
    levels.push(current);
    const next = [];
    current.forEach((id) => {
      if (visited.has(id)) return;
      visited.add(id);
      const node = byId.get(id);
      node?.relations.childrenIds.forEach((cid) => {
        if (byId.has(cid)) next.push(cid);
      });
    });
    current = [...new Set(next)];
  }

  const html = levels.map((ids, idx) => `
    <div class="family-level-wrap">
      <div class="family-level">
        ${ids.map((id) => {
          const n = byId.get(id);
          return `<button class="family-node" type="button" data-family-node="${n.id}">${n.name.full}<br><small>${n.age}세 · ${n.race}</small></button>`;
        }).join('')}
      </div>
      ${idx < levels.length - 1 ? '<div class="family-connector"></div>' : ''}
    </div>
  `).join('');

  setTimeout(() => {
    $('familyTitle').textContent = `${focus.family} 패밀리 트리 · 기준: ${focus.name.full}`;
    treeEl.innerHTML = html || '<p>표시할 계보 데이터가 없습니다.</p>';
    treeEl.querySelectorAll('[data-family-node]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextId = Number(btn.dataset.familyNode);
        $('familyFocusSelect').value = String(nextId);
        renderFamilyTree(nextId, true);
      });
      btn.addEventListener('dblclick', () => openNpcModal(Number(btn.dataset.familyNode)));
    });
    treeEl.classList.remove('is-switching');
  }, animate ? 170 : 0);
}

setup();
