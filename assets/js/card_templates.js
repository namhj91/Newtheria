(function attachCardTemplates(global) {
  const DEFAULT_BACK = {
    sigil: '✦',
    brand: 'AetheriA'
  };

  const DEFAULT_BEHAVIOR = {
    cardVerticalStep: 14,
    dragThresholdPx: 5,
    longPressMs: 440,
    longPressMoveTolerancePx: 8,
    hoverPushMax: 44,
    hoverLiftY: -14,
    hoverScale: 1.03,
    hoverDistanceRatioNear: 0.56,
    hoverDistanceRatioFar: 0.28,
    settleMs: 420
  };
  const DEFAULT_REROLL = {
    flipToBackMs: 280,
    collectMs: 360,
    spinMs: 1080,
    spreadBaseMs: 420,
    spreadStepMs: 40,
    flipToFrontMs: 200
  };
  const DEFAULT_STACK = {
    txMin: 4,
    txRange: 20,
    tyRange: 18,
    tyCenterOffset: 9,
    rotRange: 6,
    rotCenterOffset: 3,
    spinTurnsDeg: 360,
    spinCycles: 3
  };

  const buildCardMarkup = ({ icon, label, desc, brand, sigil }) => `
    <span class="card-fan-card-spin">
      <span class="card-fan-card-inner">
        <span class="card-fan-card-face card-fan-front">
          <span class="icon" aria-hidden="true">${icon}</span>
          <span class="label">${label}</span>
          <span class="desc">${desc}</span>
        </span>
        <span class="card-fan-card-face card-fan-back">
          <span class="orbit"></span>
          <span class="sigil">${sigil}</span>
          <span class="brand">${brand}</span>
        </span>
      </span>
    </span>
  `;

  const createCardFanCard = ({ route, icon, label, desc, brand = DEFAULT_BACK.brand, sigil = DEFAULT_BACK.sigil }) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card-fan-card';
    card.dataset.route = route;
    card.innerHTML = buildCardMarkup({ icon, label, desc, brand, sigil });
    return card;
  };

  const renderCardFanCards = (menu, items = []) => {
    if (!menu) return [];
    menu.replaceChildren(...items.map((item) => createCardFanCard(item)));
    return [...menu.querySelectorAll('.card-fan-card')];
  };

  const createCardFanBehavior = ({ menu, cards, ui = {} }) => {
    const config = { ...DEFAULT_BEHAVIOR, ...ui };
    // 선택지 카드가 자주 재생성되는 화면(대화 테스트 등)에서 이벤트 누적을 막기 위해
    // AbortController로 이번 인스턴스의 모든 리스너를 묶어 해제한다.
    const listenersController = typeof AbortController === 'function' ? new AbortController() : null;
    const listenerOptions = listenersController ? { signal: listenersController.signal } : undefined;
    const dragState = {
      pointerId: null,
      card: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
      pendingDx: 0,
      pendingDy: 0,
      frameRequest: null,
      moved: false,
      dragging: false,
      longPressTimer: null,
      longPressTriggered: false
    };

    // 카드 팬 컨테이너 폭이 늦게 확정되는 환경(테스트 패널 토글/뷰포트 회전)에서도
    // 카드 간격이 다시 계산되도록 resize 옵저버를 유지한다.
    let resizeObserver = null;

    const clearLongPressTimer = () => {
      if (dragState.longPressTimer === null) return;
      window.clearTimeout(dragState.longPressTimer);
      dragState.longPressTimer = null;
    };

    const startLongPressTimer = (card) => {
      clearLongPressTimer();
      dragState.longPressTimer = window.setTimeout(() => {
        if (!dragState.card || dragState.card !== card || dragState.dragging || dragState.moved) return;
        dragState.longPressTriggered = true;
        card.classList.toggle('is-flipped');
        card.dataset.consumeClick = 'true';
      }, config.longPressMs);
    };

    const scheduleDragRender = () => {
      if (!dragState.card || dragState.frameRequest !== null) return;
      dragState.frameRequest = window.requestAnimationFrame(() => {
        dragState.frameRequest = null;
        if (!dragState.card) return;
        dragState.card.style.transform = `translate(${dragState.offsetX + dragState.pendingDx}px, ${dragState.offsetY + dragState.pendingDy}px) rotate(0deg)`;
      });
    };

    const clearDragFrame = () => {
      if (dragState.frameRequest === null) return;
      window.cancelAnimationFrame(dragState.frameRequest);
      dragState.frameRequest = null;
    };

    const calcHoverPush = (distance) => {
      if (distance <= 0) return 0;
      if (distance === 1) return config.hoverPushMax;
      if (distance === 2) return Math.round(config.hoverPushMax * config.hoverDistanceRatioNear);
      return Math.round(config.hoverPushMax * config.hoverDistanceRatioFar);
    };

    const applyCardTransforms = (hoveredCard = null) => {
      cards.forEach((card, i) => {
        const baseTransform = card.dataset.baseTransform || 'translate(0px, 0px) rotate(0deg)';
        card.classList.toggle('is-hovered', card === hoveredCard);

        if (card.classList.contains('dragging')) return;

        let shiftX = 0;
        let hoverY = 0;
        let hoverScale = 1;

        if (hoveredCard) {
          const hoveredIndex = cards.indexOf(hoveredCard);
          if (i !== hoveredIndex) {
            const direction = i < hoveredIndex ? -1 : 1;
            const distance = Math.abs(i - hoveredIndex);
            shiftX = direction * calcHoverPush(distance);
          } else {
            hoverY = config.hoverLiftY;
            hoverScale = config.hoverScale;
          }
        }

        card.style.transform = `${baseTransform} translateX(${shiftX}px) translateY(${hoverY}px) scale(${hoverScale})`;
      });
    };

    const layoutCards = () => {
      const mid = (cards.length - 1) / 2;
      // 화면별로 오버라이드된 팬 변수(menu scope)를 우선 사용하고, 없으면 전역값으로 폴백한다.
      const scopedComputedStyle = getComputedStyle(menu);
      const rootComputedStyle = getComputedStyle(document.documentElement);
      const fanGap = parseFloat(scopedComputedStyle.getPropertyValue('--fan-gap')) || parseFloat(rootComputedStyle.getPropertyValue('--fan-gap')) || 92;
      const fanTilt = parseFloat(scopedComputedStyle.getPropertyValue('--fan-tilt')) || parseFloat(rootComputedStyle.getPropertyValue('--fan-tilt')) || 13;
      const cardFanWidth = menu.clientWidth || menu.getBoundingClientRect().width || menu.parentElement?.clientWidth || 0;
      const firstCardWidth = cards[0]?.getBoundingClientRect().width || 0;

      let responsiveFanGap = fanGap;
      if (mid > 0 && cardFanWidth > 0 && firstCardWidth > 0) {
        const safePadding = 8;
        const availableHalfWidth = Math.max(0, (cardFanWidth - firstCardWidth) / 2 - safePadding);
        const maxGap = availableHalfWidth / mid;
        responsiveFanGap = Math.max(12, Math.min(fanGap, maxGap));
      }

      cards.forEach((card, i) => {
        const offset = i - mid;
        const tx = offset * responsiveFanGap;
        const ty = Math.abs(offset) * config.cardVerticalStep;
        const rot = offset * fanTilt;

        card.style.setProperty('--tx', `${tx}px`);
        card.style.setProperty('--ty', `${ty}px`);
        card.style.setProperty('--rot', `${rot}deg`);
        card.dataset.baseTransform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
        card.style.transform = card.dataset.baseTransform;
        card.style.zIndex = String(100 + (cards.length - i));
      });

      applyCardTransforms();
    };

    const shuffleCardOrder = () => {
      for (let i = cards.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
      }
      cards.forEach((card) => menu.appendChild(card));
    };

    const resetDraggedCard = (card) => {
      card.classList.remove('dragging');
      card.style.transition = 'transform .4s cubic-bezier(0.18, 0.9, 0.35, 1.2)';
      card.style.transform = card.dataset.baseTransform;

      window.setTimeout(() => {
        card.style.transition = '';
        applyCardTransforms(menu.querySelector('.card-fan-card.is-hovered'));
      }, config.settleMs);
    };

    const attachAutoLayoutSync = () => {
      window.addEventListener('resize', layoutCards, listenerOptions);
      if (typeof ResizeObserver !== 'function') return;
      resizeObserver = new ResizeObserver(() => {
        layoutCards();
      });
      resizeObserver.observe(menu);
    };

    const bindInteractions = ({
      isLocked = () => false,
      onCardSelected = () => {},
      shouldDiscardDrop = () => false,
      onCardDiscarded = () => {},
      onDragStateChange = () => {},
      onDragMove = () => {}
    } = {}) => {
      attachAutoLayoutSync();

      menu.addEventListener('click', (e) => {
        const card = e.target.closest('.card-fan-card');
        if (!card || isLocked()) return;
        onCardSelected(card, cards);
      }, listenerOptions);

      cards.forEach((card) => {
        card.addEventListener('pointerdown', (e) => {
          if (isLocked()) return;

          dragState.pointerId = e.pointerId;
          dragState.card = card;
          dragState.startX = e.clientX;
          dragState.startY = e.clientY;
          dragState.offsetX = parseFloat(card.style.getPropertyValue('--tx')) || 0;
          dragState.offsetY = parseFloat(card.style.getPropertyValue('--ty')) || 0;
          dragState.pendingDx = 0;
          dragState.pendingDy = 0;
          dragState.moved = false;
          dragState.dragging = false;
          dragState.longPressTriggered = false;

          card.setPointerCapture(e.pointerId);
          startLongPressTimer(card);
        }, listenerOptions);

        card.addEventListener('pointermove', (e) => {
          if (!dragState.card || dragState.pointerId !== e.pointerId) return;

          const dx = e.clientX - dragState.startX;
          const dy = e.clientY - dragState.startY;
          if (Math.hypot(dx, dy) > config.longPressMoveTolerancePx) {
            clearLongPressTimer();
          }
          if (Math.hypot(dx, dy) > config.dragThresholdPx) {
            dragState.moved = true;
            clearLongPressTimer();
            if (!dragState.dragging) {
              dragState.dragging = true;
              dragState.card.classList.add('dragging');
              onDragStateChange(true, { card: dragState.card, event: e, moved: true });
            }
          }

          if (!dragState.dragging) return;

          dragState.pendingDx = dx;
          dragState.pendingDy = dy;
          scheduleDragRender();
          onDragMove({ card: dragState.card, event: e, moved: dragState.moved });
        }, listenerOptions);

        const releaseDrag = (e) => {
          if (!dragState.card || dragState.pointerId !== e.pointerId) return;

          const draggedCard = dragState.card;
          const wasDragging = dragState.dragging;
          const wasLongPress = dragState.longPressTriggered;
          const droppedOnDiscard = dragState.moved && shouldDiscardDrop({ card: draggedCard, event: e });
          clearLongPressTimer();
          clearDragFrame();
          draggedCard.releasePointerCapture(e.pointerId);
          if (droppedOnDiscard) {
            draggedCard.classList.remove('dragging');
            draggedCard.remove();
            const removedIndex = cards.indexOf(draggedCard);
            if (removedIndex >= 0) {
              cards.splice(removedIndex, 1);
            }
            layoutCards();
            onCardDiscarded(draggedCard, cards);
          } else if (wasDragging) {
            resetDraggedCard(draggedCard);
          }

          dragState.pointerId = null;
          dragState.card = null;
          dragState.moved = false;
          dragState.dragging = false;
          dragState.longPressTriggered = false;
          if (wasDragging) {
            onDragStateChange(false, { card: draggedCard, event: e, moved: false, discarded: droppedOnDiscard });
          }
          if (wasLongPress) {
            onDragMove({ card: draggedCard, event: e, moved: false, longPress: true });
          }
        };

        card.addEventListener('pointerup', releaseDrag, listenerOptions);
        card.addEventListener('pointercancel', releaseDrag, listenerOptions);

        const handleHoverEnter = () => {
          if (isLocked()) return;
          applyCardTransforms(card);
        };

        const handleHoverLeave = () => {
          if (isLocked()) return;
          applyCardTransforms();
        };

        // 포인터 기반 디바이스(펜/터치패드 포함)에서도 hover 반응이 일관되게 동작하도록
        // mouseenter/leave + pointerenter/leave를 함께 바인딩한다.
        card.addEventListener('mouseenter', handleHoverEnter, listenerOptions);
        card.addEventListener('mouseleave', handleHoverLeave, listenerOptions);
        card.addEventListener('pointerenter', handleHoverEnter, listenerOptions);
        card.addEventListener('pointerleave', handleHoverLeave, listenerOptions);

        card.addEventListener('focus', () => {
          if (isLocked()) return;
          applyCardTransforms(card);
        }, listenerOptions);

        card.addEventListener('blur', () => {
          if (isLocked()) return;
          applyCardTransforms();
        }, listenerOptions);

        card.addEventListener('click', (e) => {
          if (card.dataset.consumeClick === 'true') {
            card.dataset.consumeClick = 'false';
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (!dragState.moved) return;
          e.preventDefault();
          e.stopPropagation();
          dragState.moved = false;
        }, listenerOptions);
      });
    };

    return {
      applyCardTransforms,
      bindInteractions,
      layoutCards,
      shuffleCardOrder,
      resetDraggedCard,
      getCards: () => cards,
      destroy() {
        listenersController?.abort();
        resizeObserver?.disconnect();
        resizeObserver = null;
      }
    };
  };

  const setActiveCard = (cards = [], activeCard = null) => {
    cards.forEach((card) => card.classList.toggle('active', card === activeCard));
  };

  const createCardFanReroll = ({
    menu,
    getCards,
    layout,
    timing = {},
    stack = {},
    isLocked = () => false,
    setLocked = () => {},
    beforePlay = () => {},
    afterPlay = () => {}
  }) => {
    const rerollTiming = { ...DEFAULT_REROLL, ...timing };
    const stackConfig = { ...DEFAULT_STACK, ...stack };

    const randomStackTransform = (_, i) => {
      const direction = i % 2 === 0 ? 1 : -1;
      const tx = Math.round((Math.random() * stackConfig.txRange + stackConfig.txMin) * direction);
      const ty = Math.round(Math.random() * stackConfig.tyRange - stackConfig.tyCenterOffset);
      const rot = ((Math.random() * stackConfig.rotRange) - stackConfig.rotCenterOffset).toFixed(2);
      return `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
    };

    const play = async () => {
      if (!menu || isLocked()) return;
      const cards = getCards();
      if (!cards.length) return;

      setLocked(true);
      try {
        beforePlay(cards);

        cards.forEach((card) => card.classList.add('is-flipped'));
        await Promise.all(cards.map((card) => {
          const inner = card.querySelector('.card-fan-card-inner');
          return inner.animate([
            { transform: 'rotateY(0deg)' },
            { transform: 'rotateY(180deg)' }
          ], { duration: rerollTiming.flipToBackMs, easing: 'ease-in-out' }).finished;
        }));

        const stackTransforms = cards.map(randomStackTransform);
        await Promise.all(cards.map((card, i) => card.animate([
          { transform: card.dataset.baseTransform },
          { transform: stackTransforms[i] }
        ], { duration: rerollTiming.collectMs, easing: 'cubic-bezier(0.16, 0.84, 0.44, 1)' }).finished));
        cards.forEach((card, i) => {
          card.style.transform = stackTransforms[i];
        });

        await Promise.all(cards.map((card, i) => {
          const spinLayer = card.querySelector('.card-fan-card-spin');
          const direction = i % 2 === 0 ? 1 : -1;
          const turn = direction * stackConfig.spinTurnsDeg;
          return spinLayer.animate([
            { transform: 'rotate(0deg)' },
            { transform: `rotate(${turn}deg)`, offset: 1 / stackConfig.spinCycles },
            { transform: 'rotate(0deg)', offset: 2 / stackConfig.spinCycles },
            { transform: `rotate(${turn}deg)`, offset: 1 }
          ], { duration: rerollTiming.spinMs, easing: 'ease-in-out' }).finished;
        }));

        layout.shuffleCardOrder();
        const shuffledCards = getCards();
        layout.layoutCards();
        await Promise.all(shuffledCards.map((card, i) => {
          const target = card.dataset.baseTransform;
          return card.animate([
            { transform: stackTransforms[i] },
            { transform: target }
          ], { duration: rerollTiming.spreadBaseMs + i * rerollTiming.spreadStepMs, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }).finished;
        }));

        for (const card of shuffledCards) {
          const inner = card.querySelector('.card-fan-card-inner');
          await inner.animate([
            { transform: 'rotateY(180deg)' },
            { transform: 'rotateY(0deg)' }
          ], { duration: rerollTiming.flipToFrontMs, easing: 'ease-in-out' }).finished;
          card.classList.remove('is-flipped');
          card.style.transform = card.dataset.baseTransform;
        }

        afterPlay(shuffledCards);
      } finally {
        setLocked(false);
      }
    };

    return { play };
  };

  const createDiscardZoneController = ({
    zone,
    documentBody = document.body,
    revealDistancePx = 150,
    activeClassName = 'drag-discard-active',
    visibleClassName = 'drag-discard-visible',
    hotClassName = 'is-hot'
  } = {}) => {
    let cachedRect = null;

    const updateHotState = (isHot) => {
      if (!zone) return;
      zone.classList.toggle(hotClassName, isHot);
    };

    const cacheRect = () => {
      if (!zone) {
        cachedRect = null;
        return null;
      }
      cachedRect = zone.getBoundingClientRect();
      return cachedRect;
    };

    const getRect = () => cachedRect || cacheRect();

    const getHitState = (pointerEvent) => {
      const rect = getRect();
      if (!rect || !pointerEvent) {
        return { inside: false, near: false };
      }
      const clampedX = Math.max(rect.left, Math.min(pointerEvent.clientX, rect.right));
      const clampedY = Math.max(rect.top, Math.min(pointerEvent.clientY, rect.bottom));
      const dx = pointerEvent.clientX - clampedX;
      const dy = pointerEvent.clientY - clampedY;
      const distanceSq = (dx * dx) + (dy * dy);
      const revealDistanceSq = revealDistancePx * revealDistancePx;
      return {
        inside: distanceSq === 0,
        near: distanceSq <= revealDistanceSq
      };
    };

    const reset = () => {
      documentBody.classList.remove(visibleClassName);
      documentBody.classList.remove(activeClassName);
      updateHotState(false);
      cachedRect = null;
    };

    const onDragStateChange = (isDragging) => {
      documentBody.classList.toggle(activeClassName, isDragging);
      if (isDragging) {
        cacheRect();
        return;
      }
      documentBody.classList.remove(visibleClassName);
      updateHotState(false);
      cachedRect = null;
    };

    const onDragMove = ({ event, moved }) => {
      if (!moved) {
        documentBody.classList.remove(visibleClassName);
        updateHotState(false);
        return;
      }
      const hit = getHitState(event);
      documentBody.classList.toggle(visibleClassName, hit.near);
      updateHotState(hit.inside);
    };

    const shouldDiscardDrop = ({ event }) => getHitState(event).inside;
    const isNear = (event) => getHitState(event).near;

    return {
      cacheRect,
      reset,
      onDragMove,
      onDragStateChange,
      shouldDiscardDrop,
      isNear
    };
  };

  global.NewtheriaCardTemplates = {
    createCardFanCard,
    renderCardFanCards,
    createCardFanBehavior,
    createCardFanReroll,
    createDiscardZoneController,
    setActiveCard
  };
}(window));
