/**
 * 캐릭터 정보 템플릿 카드.
 * - 카드 앞면: 요약 정보
 * - 롱프레스: 카드 뒤집기 + 확대 + 상세 탭 노출
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

  const cardButton = document.createElement('button');
  cardButton.type = 'button';
  cardButton.className = 'character-profile-card';
  cardButton.innerHTML = `
    <span class="character-profile-card__spin">
      <span class="character-profile-card__inner">
        <span class="character-profile-card__face character-profile-card__front">
          <span class="character-profile-card__front-body" data-front-body></span>
          <span class="character-profile-card__hint">꾹 눌러 상세 보기</span>
        </span>
        <span class="character-profile-card__face character-profile-card__back">
          <span class="orbit"></span>
          <span class="sigil">✦</span>
          <span class="brand">Newtheria</span>
          <span class="message">상세 분석 모드</span>
        </span>
      </span>
    </span>
  `;

  const details = document.createElement('section');
  details.className = 'character-profile-details';
  details.hidden = true;

  const tabNav = document.createElement('nav');
  tabNav.className = 'character-profile-tabs';
  const tabPanel = document.createElement('div');
  tabPanel.className = 'character-profile-panel';

  details.append(tabNav, tabPanel);
  root.append(cardButton, details);
  mount.replaceChildren(root);

  const frontBody = cardButton.querySelector('[data-front-body]');

  let activeTab = tabs[0]?.key || '';
  let longPressTimer = null;
  let startPoint = null;
  let opened = false;

  const setOpened = (value) => {
    opened = value;
    root.classList.toggle('is-opened', value);
    cardButton.classList.toggle('is-flipped', value);
    details.hidden = !value;
    if (value) onOpen();
  };

  const renderTabs = () => {
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
