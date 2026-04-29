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
  const nav = document.querySelector('.dev-nav');
  const worldBuildStatus = document.getElementById('worldBuildStatus');
  const worldBuildSteps = Array.from(document.querySelectorAll('#worldBuildSteps li'));
  const startWorldBuildButton = document.getElementById('startWorldBuildButton');
  const worldBuildResult = document.getElementById('worldBuildResult');
  let worldBuildStarted = false;
  let worldBuildTimer = null;

  if (!views.length || !nav) {
    console.warn('[MainViewRouter] 초기화에 필요한 DOM을 찾지 못했습니다.');
    return;
  }

  // 지정한 id의 뷰만 활성화하고 나머지는 비활성화한다.
  const activateView = (viewId) => {
    views.forEach((view) => {
      const isActive = view.id === viewId;
      view.dataset.active = isActive ? 'true' : 'false';
    });

    if (viewId === DIALOGUE_VIEW_ID) {
      dialogueController.ensureMounted();
    }

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
    return { entry, slotId };
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
        csvUrl: './assets/data/dialogue_sample.asdf',
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

  // 개발용 버튼 클릭 시 해당 뷰로 전환한다.
  nav.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-view]');
    if (!button) return;
    activateView(button.dataset.view);
  });

  const entryContext = parseEntryContext();
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
