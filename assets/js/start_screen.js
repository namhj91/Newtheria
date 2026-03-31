const menu = document.getElementById('menu');
let cards = [...menu.querySelectorAll('.card-fan-card')];
const overlay = document.querySelector('.overlay');
const eggButton = document.getElementById('easterEgg');
const titleWorldMapButton = document.getElementById('titleWorldMap');
const rootStyle = document.documentElement.style;

const UI = {
  cardVerticalStep: 14,
  rerollOverlayMs: 620,
  dragThresholdPx: 5,
  hoverPushMax: 44,
  hoverLiftY: -14,
  hoverScale: 1.03,
  hoverDistanceRatioNear: 0.56,
  hoverDistanceRatioFar: 0.28,
  reroll: {
    flipToBackMs: 280,
    collectMs: 360,
    spinMs: 1080,
    spreadBaseMs: 420,
    spreadStepMs: 40,
    flipToFrontMs: 200,
    settleMs: 420
  },
  stack: {
    txMin: 4,
    txRange: 20,
    tyRange: 18,
    tyCenterOffset: 9,
    rotRange: 6,
    rotCenterOffset: 3,
    spinTurnsDeg: 360,
    spinCycles: 3
  }
};

const dragState = {
  pointerId: null,
  card: null,
  startX: 0,
  startY: 0,
  offsetX: 0,
  offsetY: 0,
  moved: false
};

const randomBetween = (min, max) => Math.random() * (max - min) + min;

const layout = {
  calcHoverPush(distance) {
    if (distance <= 0) return 0;
    if (distance === 1) return UI.hoverPushMax;
    if (distance === 2) return Math.round(UI.hoverPushMax * UI.hoverDistanceRatioNear);
    return Math.round(UI.hoverPushMax * UI.hoverDistanceRatioFar);
  },

  applyCardTransforms(hoveredCard = null) {
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
          shiftX = direction * this.calcHoverPush(distance);
        } else {
          hoverY = UI.hoverLiftY;
          hoverScale = UI.hoverScale;
        }
      }

      card.style.transform = `${baseTransform} translateX(${shiftX}px) translateY(${hoverY}px) scale(${hoverScale})`;
    });
  },

  layoutCards() {
    const mid = (cards.length - 1) / 2;
    const rootComputedStyle = getComputedStyle(document.documentElement);
    const fanGap = parseFloat(rootComputedStyle.getPropertyValue('--fan-gap'));
    const fanTilt = parseFloat(rootComputedStyle.getPropertyValue('--fan-tilt'));

    cards.forEach((card, i) => {
      const offset = i - mid;
      const tx = offset * fanGap;
      const ty = Math.abs(offset) * UI.cardVerticalStep;
      const rot = offset * fanTilt;

      card.style.setProperty('--tx', `${tx}px`);
      card.style.setProperty('--ty', `${ty}px`);
      card.style.setProperty('--rot', `${rot}deg`);
      card.dataset.baseTransform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
      card.style.transform = card.dataset.baseTransform;
      card.style.zIndex = String(100 + (cards.length - i));
    });

    this.applyCardTransforms();
  },

  shuffleCardOrder() {
    for (let i = cards.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    cards.forEach((card) => menu.appendChild(card));
  }
};

const effects = {
  createStarLayer({ count, minRadius, maxRadius, alphaMin, alphaMax, palette }) {
    const gradients = [];

    for (let i = 0; i < count; i += 1) {
      const x = randomBetween(0, 100).toFixed(2);
      const y = randomBetween(0, 100).toFixed(2);
      const radius = randomBetween(minRadius, maxRadius);
      const fadeRadius = radius + randomBetween(0.9, 1.8);
      const alpha = randomBetween(alphaMin, alphaMax).toFixed(2);
      const color = palette[Math.floor(Math.random() * palette.length)];
      gradients.push(`radial-gradient(circle at ${x}% ${y}%, rgba(${color}, ${alpha}) 0 ${radius.toFixed(2)}px, transparent ${fadeRadius.toFixed(2)}px)`);
    }

    return gradients.join(', ');
  },

  applyStarField() {
    rootStyle.setProperty('--stars-a', this.createStarLayer({
      count: 210,
      minRadius: 0.35,
      maxRadius: 1.35,
      alphaMin: 0.46,
      alphaMax: 0.94,
      palette: ['233, 242, 255', '214, 229, 255', '190, 214, 255']
    }));

    rootStyle.setProperty('--stars-b', this.createStarLayer({
      count: 160,
      minRadius: 0.45,
      maxRadius: 1.55,
      alphaMin: 0.36,
      alphaMax: 0.88,
      palette: ['178, 205, 255', '154, 187, 255', '133, 168, 245']
    }));

    rootStyle.setProperty('--twinkle-a', this.createStarLayer({
      count: 84,
      minRadius: 0.55,
      maxRadius: 1.95,
      alphaMin: 0.5,
      alphaMax: 0.98,
      palette: ['255, 255, 255', '238, 246, 255']
    }));

    rootStyle.setProperty('--twinkle-b', this.createStarLayer({
      count: 74,
      minRadius: 0.6,
      maxRadius: 2.15,
      alphaMin: 0.42,
      alphaMax: 0.86,
      palette: ['184, 208, 255', '163, 190, 252', '146, 177, 248']
    }));
  }
};

const reroll = {
  async play() {
    if (menu.classList.contains('rerolling')) return;

    menu.classList.remove('selecting');
    layout.applyCardTransforms();
    cards.forEach((c) => c.classList.remove('active'));
    menu.classList.add('rerolling');

    // 1) Flip cards to the back before shuffling
    cards.forEach((card) => card.classList.add('is-flipped'));
    await Promise.all(cards.map((card) => {
      const inner = card.querySelector('.card-fan-card-inner');
      return inner.animate([
        { transform: 'rotateY(0deg)' },
        { transform: 'rotateY(180deg)' }
      ], { duration: UI.reroll.flipToBackMs, easing: 'ease-in-out' }).finished;
    }));

    // 2) Collect to center as an overlapped, slightly messy deck
    const stackTransforms = cards.map((_, i) => {
      const direction = i % 2 === 0 ? 1 : -1;
      const tx = Math.round((Math.random() * UI.stack.txRange + UI.stack.txMin) * direction);
      const ty = Math.round(Math.random() * UI.stack.tyRange - UI.stack.tyCenterOffset);
      const rot = ((Math.random() * UI.stack.rotRange) - UI.stack.rotCenterOffset).toFixed(2);
      return `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
    });

    await Promise.all(cards.map((card, i) => card.animate([
      { transform: card.dataset.baseTransform },
      { transform: stackTransforms[i] }
    ], { duration: UI.reroll.collectMs, easing: 'cubic-bezier(0.16, 0.84, 0.44, 1)' }).finished));
    cards.forEach((card, i) => {
      card.style.transform = stackTransforms[i];
    });

    // 3) Rotate each card 3 times, reversing direction every turn
    await Promise.all(cards.map((card, i) => {
      const spinLayer = card.querySelector('.card-fan-card-spin');
      const direction = i % 2 === 0 ? 1 : -1;
      const turn = direction * UI.stack.spinTurnsDeg;
      return spinLayer.animate([
        { transform: 'rotate(0deg)' },
        { transform: `rotate(${turn}deg)`, offset: 1 / UI.stack.spinCycles },
        { transform: 'rotate(0deg)', offset: 2 / UI.stack.spinCycles },
        { transform: `rotate(${turn}deg)`, offset: 1 }
      ], { duration: UI.reroll.spinMs, easing: 'ease-in-out' }).finished;
    }));

    // 4) Shuffle and spread to fan layout (cards stay back-facing)
    layout.shuffleCardOrder();
    layout.layoutCards();
    await Promise.all(cards.map((card, i) => {
      const target = card.dataset.baseTransform;
      return card.animate([
        { transform: stackTransforms[i] },
        { transform: target }
      ], { duration: UI.reroll.spreadBaseMs + i * UI.reroll.spreadStepMs, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }).finished;
    }));

    // 5) Flip back to front one by one after shuffle
    for (const card of cards) {
      const inner = card.querySelector('.card-fan-card-inner');
      await inner.animate([
        { transform: 'rotateY(180deg)' },
        { transform: 'rotateY(0deg)' }
      ], { duration: UI.reroll.flipToFrontMs, easing: 'ease-in-out' }).finished;

      card.classList.remove('is-flipped');
      card.style.transform = card.dataset.baseTransform;
    }

    menu.classList.remove('rerolling');
  }
};

const drag = {
  resetDraggedCard(card) {
    card.classList.remove('dragging');
    card.style.transition = 'transform .4s cubic-bezier(0.18, 0.9, 0.35, 1.2)';
    card.style.transform = card.dataset.baseTransform;

    window.setTimeout(() => {
      card.style.transition = '';
      layout.applyCardTransforms(menu.querySelector('.card-fan-card.is-hovered'));
    }, UI.reroll.settleMs);
  },

  onPointerMove(e) {
    if (!dragState.card || dragState.pointerId !== e.pointerId) return;

    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if (Math.hypot(dx, dy) > UI.dragThresholdPx) dragState.moved = true;

    dragState.card.style.transform = `translate(${dragState.offsetX + dx}px, ${dragState.offsetY + dy}px) rotate(0deg)`;
  },

  onPointerUp(e) {
    if (!dragState.card || dragState.pointerId !== e.pointerId) return;

    const card = dragState.card;
    card.releasePointerCapture(e.pointerId);
    this.resetDraggedCard(card);

    dragState.pointerId = null;
    dragState.card = null;
  }
};

const bindEvents = () => {
  menu.addEventListener('click', (e) => {
    const card = e.target.closest('.card-fan-card');
    if (!card || menu.classList.contains('rerolling')) return;

    menu.classList.add('selecting');
    cards.forEach((c) => c.classList.remove('active'));
    card.classList.add('active');

    overlay.classList.add('play');
    setTimeout(() => overlay.classList.remove('play'), UI.rerollOverlayMs);
  });

  cards.forEach((card) => {
    card.addEventListener('pointerdown', (e) => {
      if (menu.classList.contains('rerolling')) return;

      dragState.pointerId = e.pointerId;
      dragState.card = card;
      dragState.startX = e.clientX;
      dragState.startY = e.clientY;
      dragState.offsetX = parseFloat(card.style.getPropertyValue('--tx')) || 0;
      dragState.offsetY = parseFloat(card.style.getPropertyValue('--ty')) || 0;
      dragState.moved = false;

      card.classList.add('dragging');
      card.setPointerCapture(e.pointerId);
    });

    card.addEventListener('pointermove', (e) => drag.onPointerMove(e));
    card.addEventListener('pointerup', (e) => drag.onPointerUp(e));
    card.addEventListener('pointercancel', (e) => drag.onPointerUp(e));

    card.addEventListener('mouseenter', () => {
      if (menu.classList.contains('rerolling')) return;
      layout.applyCardTransforms(card);
    });

    card.addEventListener('mouseleave', () => {
      if (menu.classList.contains('rerolling')) return;
      layout.applyCardTransforms();
    });

    card.addEventListener('focus', () => {
      if (menu.classList.contains('rerolling')) return;
      layout.applyCardTransforms(card);
    });

    card.addEventListener('blur', () => {
      if (menu.classList.contains('rerolling')) return;
      layout.applyCardTransforms();
    });

    card.addEventListener('click', (e) => {
      if (!dragState.moved) return;
      e.preventDefault();
      e.stopPropagation();
      dragState.moved = false;
    });
  });

  eggButton.addEventListener('click', () => reroll.play());
  titleWorldMapButton?.addEventListener('click', () => {
    overlay.classList.add('play');
    window.setTimeout(() => {
      window.location.href = './world_map.html';
    }, 260);
  });
  window.addEventListener('resize', () => layout.layoutCards());
};

const bootstrap = () => {
  bindEvents();
  effects.applyStarField();
  layout.layoutCards();
};

bootstrap();
