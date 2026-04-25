/**
 * 캐릭터 정보 템플릿 카드.
 * - 카드 앞면: 요약 정보
 * - 롱프레스/클릭: 카드 뒤집기 + 카드 뒷면 상세 탭 노출
 */
export const createCharacterProfileCardTemplate = ({
  mount,
  tabs = [],
  longPressMs = 460,
  onOpen = () => {}
} = {}) => {
  if (!mount) return null;

  const root = document.createElement('section');
  root.className = 'character-profile-template';

  // 사용자 지침 반영(강제 규칙):
  // "템플릿 사용"은 공용 카드 템플릿 생성기(NewtheriaCardTemplates.createCardFanCard) 상속 사용을 의미한다.
  // => 수동 마크업 조립으로 공용 카드 구조를 재구현하지 않는다.
  const cardFactory = window?.NewtheriaCardTemplates?.createCardFanCard;
  if (typeof cardFactory !== 'function') return null;
  const cardButton = cardFactory({
    route: 'npc-profile',
    icon: '🧾',
    label: 'NPC 프로필',
    desc: '카드 뒷면에서 상세 확인',
    brand: 'Newtheria',
    sigil: '✦'
  });
  cardButton.classList.add('character-profile-card');

  const frontFace = cardButton.querySelector('.card-fan-front');
  const backFace = cardButton.querySelector('.card-fan-back');
  if (!frontFace || !backFace) return null;
  frontFace.classList.add('character-profile-card__front');
  backFace.classList.add('character-profile-card__back');
  frontFace.innerHTML = `
    <span class="character-profile-card__front-body" data-front-body></span>
    <span class="character-profile-card__hint">꾹 눌러 상세 보기</span>
  `;
  backFace.innerHTML = `
    <span class="orbit"></span>
    <span class="character-profile-card__back-header">
      <span class="sigil">✦</span>
      <span class="brand">상세 분석 모드</span>
    </span>
    <nav class="character-profile-tabs" data-tab-nav></nav>
    <div class="character-profile-panel" data-tab-panel></div>
  `;
  root.append(cardButton);
  mount.replaceChildren(root);

  const frontBody = cardButton.querySelector('[data-front-body]');
  const tabNav = cardButton.querySelector('[data-tab-nav]');
  const tabPanel = cardButton.querySelector('[data-tab-panel]');

  let activeTab = tabs[0]?.key || '';
  let longPressTimer = null;
  let startPoint = null;
  let opened = false;

  const setOpened = (value) => {
    opened = value;
    root.classList.toggle('is-opened', value);
    cardButton.classList.toggle('is-flipped', value);
    if (value) onOpen();
  };

  const renderTabs = () => {
    if (!tabNav || !tabPanel) return;
    tabNav.replaceChildren();
    const targetTab = tabs.find((tab) => tab.key === activeTab) || tabs[0];
    activeTab = targetTab?.key || '';
    tabs.forEach((tab) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'character-profile-tab';
      button.textContent = tab.label;
      button.dataset.tabKey = tab.key;
      button.classList.toggle('is-active', tab.key === activeTab);
      button.addEventListener('click', () => {
        activeTab = tab.key;
        renderTabs();
      });
      tabNav.append(button);
    });

    const active = tabs.find((tab) => tab.key === activeTab);
    tabPanel.replaceChildren(active?.render?.() || document.createTextNode('표시할 데이터가 없습니다.'));
  };

  const renderFront = (nodeOrMarkup) => {
    if (!frontBody) return;
    frontBody.replaceChildren();
    if (typeof nodeOrMarkup === 'string') {
      frontBody.innerHTML = nodeOrMarkup;
      return;
    }
    if (nodeOrMarkup) frontBody.append(nodeOrMarkup);
  };

  const cancelLongPress = () => {
    if (longPressTimer === null) return;
    window.clearTimeout(longPressTimer);
    longPressTimer = null;
  };

  const triggerOpen = () => {
    if (opened) return;
    setOpened(true);
    renderTabs();
  };

  cardButton.addEventListener('click', () => {
    // 사용자 요청 반영:
    // 상세 정보는 별도 영역이 아니라 카드 "뒷면"에서 바로 보이도록 유지한다.
    if (opened) return;
    triggerOpen();
  });

  cardButton.addEventListener('pointerdown', (event) => {
    startPoint = { x: event.clientX, y: event.clientY };
    cancelLongPress();
    longPressTimer = window.setTimeout(() => {
      triggerOpen();
    }, longPressMs);
  });

  cardButton.addEventListener('pointermove', (event) => {
    if (!startPoint) return;
    const dx = event.clientX - startPoint.x;
    const dy = event.clientY - startPoint.y;
    if (Math.hypot(dx, dy) > 8) cancelLongPress();
  });

  const closePointer = () => {
    startPoint = null;
    cancelLongPress();
  };

  cardButton.addEventListener('pointerup', closePointer);
  cardButton.addEventListener('pointercancel', closePointer);
  cardButton.addEventListener('pointerleave', closePointer);

  return {
    setFrontContent: renderFront,
    setTabs: (nextTabs = []) => {
      tabs = nextTabs;
      activeTab = tabs[0]?.key || '';
      if (opened) renderTabs();
    },
    close: () => setOpened(false),
    open: () => {
      triggerOpen();
      renderTabs();
    }
  };
};
