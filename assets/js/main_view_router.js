(function initMainViewRouter(global) {
  'use strict';

  const DIALOGUE_VIEW_ID = 'view-dialogue';
  const DEFAULT_VIEW_ID = 'view-default';
  const WORLDBUILD_VIEW_ID = 'view-worldbuild';
  const WORLDMAP_VIEW_ID = 'view-worldmap';
  const DIALOGUE_MOUNT_ID = 'dialogueMount';
  const STORAGE_KEYS = Object.freeze({
    saveSlotsMeta: 'newtheria.saveSlots.meta',
    saveSlotsData: 'newtheria.saveSlots.data'
  });

  // 대화 세션 기본 진입점은 한 곳에서만 선언해 재사용한다.
  const DIALOGUE_ENTRY = Object.freeze({
    eventId: 'opening',
    sceneId: '0',
    anchor: 'intro_start'
  });

  const views = Array.from(document.querySelectorAll('.view'));
  const worldBuildStatus = document.getElementById('worldBuildStatus');
  const worldBuildSteps = Array.from(document.querySelectorAll('#worldBuildSteps li'));
  const startWorldBuildButton = document.getElementById('startWorldBuildButton');
  const worldBuildResult = document.getElementById('worldBuildResult');
  const regenWorldMapButton = document.getElementById('regenButton');
  const SESSION_KEYS = Object.freeze({
    worldMapCamera: 'newtheria.session.worldMapCamera'
  });

  let activeViewId = '';

  let worldBuildStarted = false;
  let worldBuildTimer = null;

  if (!views.length) {
    console.warn('[MainViewRouter] 초기화에 필요한 DOM을 찾지 못했습니다.');
    return;
  }

  // 지정한 id의 뷰만 활성화하고 나머지는 비활성화한다.
  const activateView = (viewId) => {
    // 월드맵에서 다른 뷰로 나갈 때 현재 카메라 상태를 세션에 저장한다.
    if (activeViewId === WORLDMAP_VIEW_ID && viewId !== WORLDMAP_VIEW_ID) {
      try {
        const cameraState = global.NewtheriaWorldMapRuntime?.getCameraState?.();
        if (cameraState) {
          global.sessionStorage?.setItem(SESSION_KEYS.worldMapCamera, JSON.stringify(cameraState));
        }
      } catch (error) {
        console.warn('[MainViewRouter] 월드맵 카메라 상태 저장에 실패했습니다.', error);
      }
    }

    views.forEach((view) => {
      const isActive = view.id === viewId;
      view.dataset.active = isActive ? 'true' : 'false';
    });

    if (viewId === DIALOGUE_VIEW_ID) {
      dialogueController.ensureMounted();
    }

    if (viewId === WORLDMAP_VIEW_ID) {
      const shouldRegen = Boolean(global.__NEWTHERIA_FORCE_REGEN_WORLD_MAP__);
      if (shouldRegen) {
        global.__NEWTHERIA_FORCE_REGEN_WORLD_MAP__ = false;
        global.setTimeout(() => {
          regenWorldMapButton?.click();
        }, 30);
      }

      try {
        const saved = global.sessionStorage?.getItem(SESSION_KEYS.worldMapCamera);
        if (saved) {
          const cameraState = JSON.parse(saved);
          global.NewtheriaWorldMapRuntime?.setCameraState?.(cameraState);
        } else {
          global.NewtheriaWorldMapRuntime?.rerender?.();
        }
      } catch (error) {
        console.warn('[MainViewRouter] 월드맵 카메라 상태 복원에 실패했습니다.', error);
      }
    }

    activeViewId = viewId;
  };

  // 대화창을 닫을 때는 기본 뷰로 복귀한다.
  const closeDialogueView = () => {
    // 다음 진입 시 이전 포인터/trace가 남지 않도록 상태를 가볍게 초기화한다.
    dialogueController.resetProgress();
    activateView(WORLDBUILD_VIEW_ID);
  };

  const clearWorldBuildTimer = () => {
    if (!worldBuildTimer) return;
    global.clearTimeout(worldBuildTimer);
    worldBuildTimer = null;
  };

  const setWorldBuildStatus = (text) => {
    if (!worldBuildStatus) return;
    worldBuildStatus.textContent = text;
  };

  const markWorldBuildStep = (index, state) => {
    const target = worldBuildSteps[index];
    if (!target) return;
    target.dataset.state = state;
  };

  const renderWorldBuildResult = (summaryText) => {
    if (!worldBuildResult) return;
    worldBuildResult.textContent = summaryText || '아직 생성된 월드맵이 없습니다.';
  };

  const queueWorldBuildSequence = () => {
    if (!worldBuildSteps.length || worldBuildStarted) return;
    worldBuildStarted = true;
    startWorldBuildButton?.setAttribute('disabled', 'true');
    startWorldBuildButton?.setAttribute('aria-disabled', 'true');
    setWorldBuildStatus('월드맵 제작을 시작합니다...');

    worldBuildSteps.forEach((_, index) => markWorldBuildStep(index, 'pending'));

    const runAt = (index) => {
      if (index >= worldBuildSteps.length) {
        // 실제 맵 생성/렌더링은 월드맵 테스트 창에서 검증한 world_map.js 로직을 그대로 사용한다.
        // 여기서는 제작 단계 완료만 처리하고, 월드맵 뷰로 전환해 해당 로직이 렌더링하도록 연결한다.
        // 월드맵 제작을 다시 수행했다면, 다음 월드맵 진입에서 1회 재생성한다.
        global.__NEWTHERIA_FORCE_REGEN_WORLD_MAP__ = true;
        renderWorldBuildResult('월드맵 생성 파이프라인 완료: world_map.js 렌더러를 사용합니다.');
        setWorldBuildStatus('월드맵 제작 완료. 월드맵 뷰를 엽니다.');
        clearWorldBuildTimer();
        global.setTimeout(() => {
          activateView(WORLDMAP_VIEW_ID);
        }, 420);
        return;
      }
      markWorldBuildStep(index, 'running');
      worldBuildTimer = global.setTimeout(() => {
        markWorldBuildStep(index, 'done');
        runAt(index + 1);
      }, 620);
    };

    runAt(0);
  };

  const isDialogueEndTrace = (trace) => (
    trace?.type === 'end' && trace?.data?.reason === 'block-end-true'
  );

  const cleanText = (value, fallback = '') => {
    if (value == null) return fallback;
    return String(value).trim();
  };

  const readJsonStorage = (key, fallback = null) => {
    try {
      const raw = global.localStorage?.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      console.warn(`[MainViewRouter] 스토리지(${key}) 파싱에 실패했습니다.`, error);
      return fallback;
    }
  };

  const writeJsonStorage = (key, value) => {
    try {
      global.localStorage?.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`[MainViewRouter] 스토리지(${key}) 저장에 실패했습니다.`, error);
      return false;
    }
  };

  const parseEntryContext = () => {
    // URL 예시
    // - 새로운 여정: ./main.html?entry=new
    // - 불러오기:   ./main.html?entry=load&slot=slot2
    const params = new URLSearchParams(global.location?.search || '');
    const entry = cleanText(params.get('entry'), 'new').toLowerCase();
    const slotId = cleanText(params.get('slot'));
    const debugMode = cleanText(params.get('DEBUGMODE')).toLowerCase() === 'on';
    return { entry, slotId, debugMode };
  };

  // DEBUGMODE=on일 때만 플로팅 디버그 메뉴를 주입한다.
  const mountDebugFloatingMenu = () => {
    const host = document.createElement('aside');
    host.className = 'debug-float';
    host.dataset.state = 'collapsed';
    host.setAttribute('aria-label', '디버그 플로팅 메뉴');

    host.innerHTML = `
      <button type="button" class="debug-float__fab" aria-expanded="false" aria-label="디버그 메뉴 열기">⚙️</button>
      <section class="debug-float__panel" aria-hidden="true">
        <header class="debug-float__header">
          <strong>DEBUG MENU</strong>
          <button type="button" class="debug-float__collapse" aria-label="디버그 메뉴 닫기">—</button>
        </header>
        <div class="debug-float__tabs" role="tablist" aria-label="디버그 탭">
          <button type="button" class="debug-float__tab is-active" role="tab" data-tab="viewport">뷰포인트</button>
          <button type="button" class="debug-float__tab" role="tab" data-tab="states">스위치/변수</button>
          <button type="button" class="debug-float__tab" role="tab" data-tab="characters">캐릭터</button>
        </div>
        <div class="debug-float__content">
          <section class="debug-float__tab-panel is-active" data-panel="viewport"></section>
          <section class="debug-float__tab-panel" data-panel="states" hidden></section>
          <section class="debug-float__tab-panel" data-panel="characters" hidden></section>
        </div>
      </section>
    `;
    document.body.appendChild(host);

    const fab = host.querySelector('.debug-float__fab');
    const panel = host.querySelector('.debug-float__panel');
    const collapseButton = host.querySelector('.debug-float__collapse');
    const viewportPanel = host.querySelector('[data-panel="viewport"]');
    const statesPanel = host.querySelector('[data-panel="states"]');
    const charactersPanel = host.querySelector('[data-panel="characters"]');
    if (viewportPanel) {
      const buttons = [
        { id: DEFAULT_VIEW_ID, label: '기본' },
        { id: DIALOGUE_VIEW_ID, label: '대화' },
        { id: WORLDBUILD_VIEW_ID, label: '맵제작' },
        { id: WORLDMAP_VIEW_ID, label: '월드맵' },
        { id: 'view-battle', label: '전투' }
      ];
      viewportPanel.innerHTML = buttons
        .map((item) => `<button type="button" class="debug-float__view-btn" data-view="${item.id}">${item.label}</button>`)
        .join('');
    }
    // 스위치/변수 탭: 페이지 + 타입 필터를 제공해 상태가 많아져도 탐색할 수 있도록 구성한다.
    if (statesPanel) {
      statesPanel.innerHTML = `
        <div class="debug-state-controls">
          <select class="debug-state-filter" aria-label="상태 타입 필터">
            <option value="all">전체</option>
            <option value="switch">스위치</option>
            <option value="variable">변수</option>
          </select>
          <div class="debug-state-pagination">
            <button type="button" class="debug-page-prev">◀</button>
            <span class="debug-page-label">1 / 1</span>
            <button type="button" class="debug-page-next">▶</button>
          </div>
        </div>
        <div class="debug-state-list" aria-live="polite"></div>
      `;
    }


    // 캐릭터 탭: localStorage 캐릭터 카탈로그/세이브 슬롯 캐릭터를 한 번에 조회/수정한다.
    if (charactersPanel) {
      charactersPanel.innerHTML = `
        <div class="debug-character-controls">
          <button type="button" class="debug-character-reload">새로고침</button>
        </div>
        <div class="debug-character-list" aria-live="polite"></div>
      `;
    }
    const setExpanded = (expanded) => {
      host.dataset.state = expanded ? 'expanded' : 'collapsed';
      fab?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      panel?.setAttribute('aria-hidden', expanded ? 'false' : 'true');
      if (!expanded) {
        host.style.removeProperty('--debug-panel-height');
        return;
      }
      global.requestAnimationFrame(() => syncPanelHeight());
    };
    let suppressFabClick = false;
    fab?.addEventListener('click', () => {
      if (suppressFabClick) {
        suppressFabClick = false;
        return;
      }
      setExpanded(host.dataset.state !== 'expanded');
    });
    collapseButton?.addEventListener('click', () => setExpanded(false));
    const syncPanelHeight = () => {
      const activePanel = host.querySelector('.debug-float__tab-panel.is-active');
      if (!activePanel) return;
      const contentHeight = Math.ceil(activePanel.scrollHeight + 74); // header + tabs + body 여백
      // 화면 높이에 맞춘 동적 상한: 작은 화면에서는 패널이 뷰포트를 넘지 않도록 안전 여백을 확보한다.
      const viewportMax = Math.max(220, Math.floor((global.innerHeight || window.innerHeight || 800) - 24));
      const clamped = Math.max(172, Math.min(viewportMax, contentHeight));
      host.style.setProperty('--debug-panel-height', `${clamped}px`);
    };
    const setActiveTab = (tabKey = 'viewport') => {
      const tabs = Array.from(host.querySelectorAll('.debug-float__tab'));
      const panels = Array.from(host.querySelectorAll('.debug-float__tab-panel'));
      tabs.forEach((tab) => tab.classList.toggle('is-active', tab.dataset.tab === tabKey));
      panels.forEach((panelEl) => {
        const isActive = panelEl.dataset.panel === tabKey;
        panelEl.classList.toggle('is-active', isActive);
        panelEl.hidden = !isActive;
      });
      global.requestAnimationFrame(() => syncPanelHeight());
    };

    const dragTarget = host;
    const dragHandle = host.querySelector('.debug-float__header');
    const dragFab = host.querySelector('.debug-float__fab');
    let dragState = null;
    const beginDrag = (pointerId, clientX, clientY, captureEl = null) => {
      const rect = dragTarget.getBoundingClientRect();
      dragState = {
        pointerId,
        offsetX: clientX - rect.left,
        offsetY: clientY - rect.top,
        startX: clientX,
        startY: clientY,
        moved: false,
        captureEl
      };
      captureEl?.setPointerCapture?.(pointerId);
    };
    const moveDrag = (clientX, clientY) => {
      if (!dragState) return;
      const movedX = Math.abs(clientX - dragState.startX);
      const movedY = Math.abs(clientY - dragState.startY);
      // 데스크톱 클릭과 드래그를 구분하기 위해 작은 이동(4px 이하)은 클릭으로 취급한다.
      if (!dragState.moved && movedX + movedY < 4) return;
      dragState.moved = true;
      const maxLeft = Math.max(8, window.innerWidth - dragTarget.offsetWidth - 8);
      const maxTop = Math.max(8, window.innerHeight - dragTarget.offsetHeight - 8);
      const nextLeft = Math.min(maxLeft, Math.max(8, clientX - dragState.offsetX));
      const nextTop = Math.min(maxTop, Math.max(8, clientY - dragState.offsetY));
      dragTarget.style.left = `${nextLeft}px`;
      dragTarget.style.top = `${nextTop}px`;
      dragTarget.style.right = 'auto';
      dragTarget.style.bottom = 'auto';
    };
    const endDrag = () => {
      if (dragState?.moved && dragState.captureEl === dragFab) suppressFabClick = true;
      dragState?.captureEl?.releasePointerCapture?.(dragState.pointerId);
      dragState = null;
    };
    dragHandle?.addEventListener('pointerdown', (event) => {
      // 헤더 내부 컨트롤(최소화 버튼) 클릭은 드래그 시작으로 취급하지 않는다.
      if (event.target.closest('button')) return;
      beginDrag(event.pointerId, event.clientX, event.clientY, dragHandle);
    });
    dragHandle?.addEventListener('pointermove', (event) => moveDrag(event.clientX, event.clientY));
    dragHandle?.addEventListener('pointerup', endDrag);
    dragHandle?.addEventListener('pointercancel', endDrag);
    // 축소 상태(⚙️만 보이는 상태)에서도 이동할 수 있도록 FAB 자체도 드래그 핸들로 허용한다.
    dragFab?.addEventListener('pointerdown', (event) => beginDrag(event.pointerId, event.clientX, event.clientY, dragFab));
    dragFab?.addEventListener('pointermove', (event) => moveDrag(event.clientX, event.clientY));
    dragFab?.addEventListener('pointerup', endDrag);
    dragFab?.addEventListener('pointercancel', endDrag);

    host.addEventListener('click', (event) => {
      const tabButton = event.target.closest('.debug-float__tab');
      if (tabButton) {
        setActiveTab(tabButton.dataset.tab || 'viewport');
        return;
      }
      const button = event.target.closest('button[data-view]');
      if (!button) return;
      activateView(button.dataset.view);
    });


    const readCharactersFromStorage = () => {
      const parseJson = (key) => {
        try {
          const raw = global.localStorage?.getItem(key);
          return raw ? JSON.parse(raw) : null;
        } catch (error) {
          return null;
        }
      };
      // 슬롯별 분리 목록이 아니라, 현재 활성 슬롯의 모든 캐릭터 묶음을 단일 편집 대상으로 노출한다.
      const root = parseJson(STORAGE_KEYS.saveSlotsData) || {};
      const slots = root?.slots && typeof root.slots === 'object' ? root.slots : {};
      const activeSlotId = cleanText(root?.activeSlotId, 'slot1') || 'slot1';
      const activeSlotPayload = slots[activeSlotId] && typeof slots[activeSlotId] === 'object' ? slots[activeSlotId] : null;
      const activeCharacters = activeSlotPayload?.characters && typeof activeSlotPayload.characters === 'object'
        ? activeSlotPayload.characters
        : null;
      return {
        activeSlotId,
        activeCharacters,
        localCatalog: parseJson('newtheria.character.catalog')
      };
    };

    const persistCharactersToStorage = (targetKey, nextPayload, activeSlotId = 'slot1') => {
      if (targetKey === 'local-catalog') {
        global.localStorage?.setItem('newtheria.character.catalog', JSON.stringify(nextPayload));
        return true;
      }
      if (targetKey !== 'active-slot-characters') return false;
      const root = readJsonStorage(STORAGE_KEYS.saveSlotsData, {});
      const slots = root?.slots && typeof root.slots === 'object' ? root.slots : {};
      const slotPayload = slots[activeSlotId];
      if (!slotPayload || typeof slotPayload !== 'object') return false;
      slots[activeSlotId] = { ...slotPayload, characters: nextPayload };
      return writeJsonStorage(STORAGE_KEYS.saveSlotsData, { ...root, slots });
    };

    const renderCharacterPanel = () => {
      if (!charactersPanel) return;
      const listEl = charactersPanel.querySelector('.debug-character-list');
      if (!listEl) return;
      const characterContext = readCharactersFromStorage();
      const sections = [];
      if (characterContext.activeCharacters) {
        sections.push(`
          <article class="debug-character-card">
            <header><strong>활성 슬롯(${characterContext.activeSlotId}) 전체 캐릭터</strong></header>
            <textarea data-char-key="active-slot-characters" data-slot-id="${characterContext.activeSlotId}" rows="10">${JSON.stringify(characterContext.activeCharacters, null, 2)}</textarea>
            <button type="button" class="debug-character-save" data-char-key="active-slot-characters" data-slot-id="${characterContext.activeSlotId}">저장</button>
          </article>
        `);
      }
      if (characterContext.localCatalog && typeof characterContext.localCatalog === 'object') {
        sections.push(`
          <article class="debug-character-card">
            <header><strong>로컬 캐릭터 카탈로그</strong></header>
            <textarea data-char-key="local-catalog" rows="8">${JSON.stringify(characterContext.localCatalog, null, 2)}</textarea>
            <button type="button" class="debug-character-save" data-char-key="local-catalog">저장</button>
          </article>
        `);
      }
      if (!sections.length) {
        listEl.innerHTML = '<p class="debug-state-empty">표시할 캐릭터 데이터가 없습니다.</p>';
        return;
      }
      listEl.innerHTML = sections.join('');
    };

    const renderStatePanel = () => {
      if (!statesPanel) return;
      const store = global.NewtheriaGameStateStore?.getStore?.('global');
      const payload = store?.getState?.() || { switches: [], variables: [] };
      const filterEl = statesPanel.querySelector('.debug-state-filter');
      const listEl = statesPanel.querySelector('.debug-state-list');
      const pageLabelEl = statesPanel.querySelector('.debug-page-label');
      const prevButton = statesPanel.querySelector('.debug-page-prev');
      const nextButton = statesPanel.querySelector('.debug-page-next');
      const pageSize = 8;
      const filter = filterEl?.value || 'all';
      const entries = [];
      if (filter !== 'variable') payload.switches.forEach((item) => entries.push({ type: 'switch', ...item }));
      if (filter !== 'switch') payload.variables.forEach((item) => entries.push({ type: 'variable', ...item }));
      entries.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
      const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
      const currentPage = Math.min(totalPages, Math.max(1, Number(statesPanel.dataset.page || '1')));
      statesPanel.dataset.page = String(currentPage);
      const start = (currentPage - 1) * pageSize;
      const pageItems = entries.slice(start, start + pageSize);
      if (pageLabelEl) pageLabelEl.textContent = `${currentPage} / ${totalPages}`;
      if (prevButton) prevButton.disabled = currentPage <= 1;
      if (nextButton) nextButton.disabled = currentPage >= totalPages;
      if (!listEl) return;
      if (!pageItems.length) {
        listEl.innerHTML = '<p class="debug-state-empty">표시할 항목이 없습니다.</p>';
        return;
      }
      listEl.innerHTML = pageItems.map((item) => `
        <label class="debug-state-row">
          <span class="debug-state-meta">#${item.id} · ${item.type === 'switch' ? 'SW' : 'VAR'} · ${item.name || '(이름없음)'}</span>
          ${item.type === 'switch'
            ? `<select data-state-type="switch" data-state-key="${item.id}"><option value="on" ${item.value ? 'selected' : ''}>ON</option><option value="off" ${!item.value ? 'selected' : ''}>OFF</option></select>`
            : `<input type="number" step="1" data-state-type="variable" data-state-key="${item.id}" value="${Number(item.value || 0)}" />`}
        </label>
      `).join('');
    };
    statesPanel?.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const type = target.dataset.stateType;
      const key = target.dataset.stateKey;
      const store = global.NewtheriaGameStateStore?.getStore?.('global');
      if (!store || !type || !key) return;
      if (type === 'switch') store.setSwitch?.(key, target.value);
      if (type === 'variable') store.setVariable?.(key, target.value);
      renderStatePanel();
      global.requestAnimationFrame(() => syncPanelHeight());
    });
    statesPanel?.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.className !== 'debug-state-filter') return;
      statesPanel.dataset.page = '1';
      renderStatePanel();
    });
    statesPanel?.addEventListener('click', (event) => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.classList.contains('debug-page-prev')) statesPanel.dataset.page = String(Math.max(1, Number(statesPanel.dataset.page || '1') - 1));
      if (target.classList.contains('debug-page-next')) statesPanel.dataset.page = String(Number(statesPanel.dataset.page || '1') + 1);
      renderStatePanel();
      global.requestAnimationFrame(() => syncPanelHeight());
    });
    renderStatePanel();

    charactersPanel?.addEventListener('click', (event) => {
      const reloadBtn = event.target.closest('.debug-character-reload');
      if (reloadBtn) {
        renderCharacterPanel();
        global.requestAnimationFrame(() => syncPanelHeight());
        return;
      }
      const saveBtn = event.target.closest('.debug-character-save');
      if (!saveBtn) return;
      const key = saveBtn.dataset.charKey || '';
      const slotId = saveBtn.dataset.slotId || '';
      const textarea = saveBtn.parentElement?.querySelector(`textarea[data-char-key="${key}"]`);
      if (!(textarea instanceof HTMLTextAreaElement)) return;
      try {
        const parsed = JSON.parse(textarea.value);
        const ok = persistCharactersToStorage(key, parsed, slotId);
        if (!ok) throw new Error('저장 경로를 찾지 못했습니다.');
        saveBtn.textContent = '저장됨';
        global.setTimeout(() => { saveBtn.textContent = '저장'; }, 900);
      } catch (error) {
        global.alert?.(`캐릭터 JSON 저장 실패: ${error.message}`);
      }
    });
    renderCharacterPanel();
  };

  const loadSaveSlotContext = (requestedSlotId = '') => {
    const meta = readJsonStorage(STORAGE_KEYS.saveSlotsMeta, {});
    const data = readJsonStorage(STORAGE_KEYS.saveSlotsData, {});
    const slots = data?.slots && typeof data.slots === 'object' ? data.slots : {};
    const fallbackSlotId = cleanText(meta?.activeSlotId || data?.activeSlotId || 'slot1', 'slot1');
    const resolvedSlotId = cleanText(requestedSlotId || fallbackSlotId, fallbackSlotId);
    const slotPayload = slots[resolvedSlotId];

    if (!slotPayload || typeof slotPayload !== 'object') {
      return {
        ok: false,
        slotId: resolvedSlotId,
        reason: 'slot-not-found'
      };
    }

    // 실제 로드 슬롯을 전역 메타에도 반영해 이후 시스템(대화 템플릿 등)과 정합을 맞춘다.
    const nextMeta = { ...meta, activeSlotId: resolvedSlotId, updatedAt: new Date().toISOString() };
    const nextData = { ...data, activeSlotId: resolvedSlotId };
    writeJsonStorage(STORAGE_KEYS.saveSlotsMeta, nextMeta);
    writeJsonStorage(STORAGE_KEYS.saveSlotsData, nextData);

    return {
      ok: true,
      slotId: resolvedSlotId,
      saveData: slotPayload
    };
  };

  // 대화 인스턴스 생명주기를 한 객체로 모아 UI 라우팅 코드와 분리한다.
  const dialogueController = {
    instance: null,
    lastTraceKey: '',
    ensureMounted() {
      if (this.instance) return this.instance;

      const mount = document.getElementById(DIALOGUE_MOUNT_ID);
      if (!mount) {
        console.error('[MainViewRouter] dialogue mount 요소를 찾지 못했습니다.');
        return null;
      }

      this.instance = global.NewtheriaDialogueTemplate.createDialogueTemplate({
        mount,
        // 메인 게임 프롤로그는 전용 데이터셋(dialogue_main.asdf)을 사용한다.
        csvUrl: './assets/data/dialogue_main.asdf',
        eventId: DIALOGUE_ENTRY.eventId,
        sceneId: DIALOGUE_ENTRY.sceneId,
        anchor: DIALOGUE_ENTRY.anchor,
        showMeta: false,
        onError: (error) => {
          console.error('[DialogueView] 대화 템플릿 오류:', error);
        },
        onDebugStateChange: (state) => {
          // trace 마지막 항목만 체크해 end 구문에서만 닫기 동작을 트리거한다.
          const trace = Array.isArray(state?.trace) ? state.trace : [];
          const lastTrace = trace[trace.length - 1] || null;
          if (!lastTrace) return;

          const key = `${lastTrace.at}|${lastTrace.type}|${JSON.stringify(lastTrace.data || {})}`;
          if (key === this.lastTraceKey) return;
          this.lastTraceKey = key;

          if (isDialogueEndTrace(lastTrace)) {
            closeDialogueView();
          }
        }
      });

      return this.instance;
    },
    resetProgress() {
      if (!this.instance) return;
      // 디버그 trace를 비우고 시작 포인터로 되감아 다음 진입 시 초기 상태를 보장한다.
      this.instance.clearDebugTrace?.();
      this.instance.jumpTo?.(DIALOGUE_ENTRY);
      this.lastTraceKey = '';
    }
  };

  const entryContext = parseEntryContext();
  if (entryContext.debugMode) {
    mountDebugFloatingMenu();
  }
  const shouldStartWithPrologue = entryContext.entry !== 'load';

  if (shouldStartWithPrologue) {
    // 로드 버튼 이외 진입은 항상 프롤로그부터 시작한다.
    activateView(DIALOGUE_VIEW_ID);
  } else {
    // 로드는 지정 슬롯을 실제로 식별/적용한 뒤 기본 뷰를 연다.
    const loadResult = loadSaveSlotContext(entryContext.slotId);
    if (!loadResult.ok) {
      console.warn('[MainViewRouter] 요청한 로드 슬롯을 찾지 못해 기본 슬롯으로 재시도합니다.', loadResult);
      const fallbackLoad = loadSaveSlotContext('slot1');
      global.NewtheriaRuntimeSession = {
        entry: 'load',
        requestedSlotId: entryContext.slotId,
        loadedSlotId: fallbackLoad.slotId,
        saveData: fallbackLoad.saveData || null
      };
      activateView(DEFAULT_VIEW_ID);
      return;
    }

    global.NewtheriaRuntimeSession = {
      entry: 'load',
      requestedSlotId: entryContext.slotId,
      loadedSlotId: loadResult.slotId,
      saveData: loadResult.saveData
    };
    activateView(DEFAULT_VIEW_ID);
  }

  // 새 진입마다 제작 결과를 화면에서만 보여준다. (영속 저장 없음)
  renderWorldBuildResult('');

  startWorldBuildButton?.addEventListener('click', () => {
    queueWorldBuildSequence();
  });

  global.addEventListener('beforeunload', () => {
    clearWorldBuildTimer();
  });
})(window);
