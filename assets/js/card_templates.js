(function attachCardTemplates(global) {
  const DEFAULT_BACK = {
    sigil: '✦',
    brand: 'AetheriA'
  };

  const DEFAULT_BEHAVIOR = {
    cardVerticalStep: 14,
    dragThresholdPx: 5,
    hoverPushMax: 44,
    hoverLiftY: -14,
    hoverScale: 1.03,
    hoverDistanceRatioNear: 0.56,
    hoverDistanceRatioFar: 0.28,
    settleMs: 420
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
      dragging: false
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
      const rootComputedStyle = getComputedStyle(document.documentElement);
      const fanGap = parseFloat(rootComputedStyle.getPropertyValue('--fan-gap'));
      const fanTilt = parseFloat(rootComputedStyle.getPropertyValue('--fan-tilt'));
      const cardFanWidth = menu.clientWidth || menu.getBoundingClientRect().width || 0;
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

    const bindInteractions = ({
      isLocked = () => false,
      onCardSelected = () => {},
      shouldDiscardDrop = () => false,
      onCardDiscarded = () => {},
      onDragStateChange = () => {},
      onDragMove = () => {}
    } = {}) => {
      menu.addEventListener('click', (e) => {
        const card = e.target.closest('.card-fan-card');
        if (!card || isLocked()) return;
        onCardSelected(card, cards);
      });

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

          card.setPointerCapture(e.pointerId);
        });

        card.addEventListener('pointermove', (e) => {
          if (!dragState.card || dragState.pointerId !== e.pointerId) return;

          const dx = e.clientX - dragState.startX;
          const dy = e.clientY - dragState.startY;
          if (Math.hypot(dx, dy) > config.dragThresholdPx) {
            dragState.moved = true;
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
        });

        const releaseDrag = (e) => {
          if (!dragState.card || dragState.pointerId !== e.pointerId) return;

          const draggedCard = dragState.card;
          const wasDragging = dragState.dragging;
          const droppedOnDiscard = dragState.moved && shouldDiscardDrop({ card: draggedCard, event: e });
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
          } else {
            resetDraggedCard(draggedCard);
          }

          dragState.pointerId = null;
          dragState.card = null;
          dragState.moved = false;
          dragState.dragging = false;
          if (wasDragging) {
            onDragStateChange(false, { card: draggedCard, event: e, moved: false, discarded: droppedOnDiscard });
          }
        };

        card.addEventListener('pointerup', releaseDrag);
        card.addEventListener('pointercancel', releaseDrag);

        card.addEventListener('mouseenter', () => {
          if (isLocked()) return;
          applyCardTransforms(card);
        });

        card.addEventListener('mouseleave', () => {
          if (isLocked()) return;
          applyCardTransforms();
        });

        card.addEventListener('focus', () => {
          if (isLocked()) return;
          applyCardTransforms(card);
        });

        card.addEventListener('blur', () => {
          if (isLocked()) return;
          applyCardTransforms();
        });

        card.addEventListener('click', (e) => {
          if (!dragState.moved) return;
          e.preventDefault();
          e.stopPropagation();
          dragState.moved = false;
        });
      });
    };

    return {
      applyCardTransforms,
      bindInteractions,
      layoutCards,
      shuffleCardOrder,
      resetDraggedCard,
      getCards: () => cards
    };
  };

  global.NewtheriaCardTemplates = {
    createCardFanCard,
    renderCardFanCards,
    createCardFanBehavior
  };
}(window));
