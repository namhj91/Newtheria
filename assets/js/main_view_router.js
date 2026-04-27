(function initMainViewRouter(global) {
  'use strict';

  const DIALOGUE_VIEW_ID = 'view-dialogue';
  const DEFAULT_VIEW_ID = 'view-default';
  const DIALOGUE_MOUNT_ID = 'dialogueMount';

  // 대화 세션 기본 진입점은 한 곳에서만 선언해 재사용한다.
  const DIALOGUE_ENTRY = Object.freeze({
    eventId: 'opening',
    sceneId: '0',
    anchor: 'intro_start'
  });

  const views = Array.from(document.querySelectorAll('.view'));
  const nav = document.querySelector('.dev-nav');

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
    activateView(DEFAULT_VIEW_ID);
  };

  const isDialogueEndTrace = (trace) => (
    trace?.type === 'end' && trace?.data?.reason === 'block-end-true'
  );

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
})(window);
