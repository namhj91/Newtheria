const menu = document.getElementById('menu');
let cards = [];

const CARD_MENU_ITEMS = [
  { route: 'new', icon: '🧭', label: '새로운 여정', desc: '처음부터 새로운 세계를 시작합니다.' },
  { route: 'continue', icon: '📜', label: '어떤 모험가의 일지', desc: '기록된 여정을 이어서 진행합니다.' },
  { route: 'codex', icon: '📚', label: '대륙견문록', desc: '인물·지리·전승 문서를 열람합니다.' },
  { route: 'mods', icon: '⚙️', label: '신의 섭리', desc: '모드 및 확장 규칙을 조정합니다.' }
];
const overlay = document.querySelector('.overlay');
const eggButton = document.getElementById('easterEgg');
const rootStyle = document.documentElement.style;


const ROUTE_PATHS = {
  new: './world_map_builder.html',
  continue: './world_map.html',
  codex: './docs/README.md',
  mods: './docs/11_모드시스템규칙.md'
};


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

const randomBetween = (min, max) => Math.random() * (max - min) + min;

let cardFanBehavior = null;

const initializeCards = () => {
  const cardTemplateApi = window.NewtheriaCardTemplates;
  if (cardTemplateApi?.renderCardFanCards) {
    cards = cardTemplateApi.renderCardFanCards(menu, CARD_MENU_ITEMS);
  } else {
    cards = [...menu.querySelectorAll('.card-fan-card')];
  }

  cardFanBehavior = cardTemplateApi?.createCardFanBehavior
    ? cardTemplateApi.createCardFanBehavior({
      menu,
      cards,
      ui: {
        cardVerticalStep: UI.cardVerticalStep,
        dragThresholdPx: UI.dragThresholdPx,
        hoverPushMax: UI.hoverPushMax,
        hoverLiftY: UI.hoverLiftY,
        hoverScale: UI.hoverScale,
        hoverDistanceRatioNear: UI.hoverDistanceRatioNear,
        hoverDistanceRatioFar: UI.hoverDistanceRatioFar,
        settleMs: UI.reroll.settleMs
      }
    })
    : null;
};

const layout = {
  applyCardTransforms(hoveredCard = null) {
    if (cardFanBehavior?.applyCardTransforms) {
      cardFanBehavior.applyCardTransforms(hoveredCard);
    }
  },

  layoutCards() {
    if (cardFanBehavior?.layoutCards) {
      cardFanBehavior.layoutCards();
    }
  },

  shuffleCardOrder() {
    if (cardFanBehavior?.shuffleCardOrder) {
      cardFanBehavior.shuffleCardOrder();
      cards = cardFanBehavior.getCards();
    }
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
      count: 340,
      minRadius: 0.28,
      maxRadius: 1.2,
      alphaMin: 0.4,
      alphaMax: 0.92,
      palette: ['233, 242, 255', '214, 229, 255', '190, 214, 255']
    }));

    rootStyle.setProperty('--stars-b', this.createStarLayer({
      count: 220,
      minRadius: 0.45,
      maxRadius: 1.62,
      alphaMin: 0.36,
      alphaMax: 0.88,
      palette: ['178, 205, 255', '154, 187, 255', '133, 168, 245']
    }));

    rootStyle.setProperty('--stars-c', this.createStarLayer({
      count: 66,
      minRadius: 1.05,
      maxRadius: 2.7,
      alphaMin: 0.42,
      alphaMax: 0.84,
      palette: ['122, 238, 255', '107, 224, 255', '184, 208, 255']
    }));

    rootStyle.setProperty('--twinkle-a', this.createStarLayer({
      count: 112,
      minRadius: 0.62,
      maxRadius: 2.1,
      alphaMin: 0.52,
      alphaMax: 0.98,
      palette: ['255, 255, 255', '238, 246, 255']
    }));

    rootStyle.setProperty('--twinkle-b', this.createStarLayer({
      count: 90,
      minRadius: 0.68,
      maxRadius: 2.4,
      alphaMin: 0.42,
      alphaMax: 0.86,
      palette: ['184, 208, 255', '163, 190, 252', '146, 177, 248']
    }));

    rootStyle.setProperty('--twinkle-c', this.createStarLayer({
      count: 42,
      minRadius: 1.2,
      maxRadius: 3.2,
      alphaMin: 0.35,
      alphaMax: 0.8,
      palette: ['138, 242, 255', '117, 230, 255']
    }));

  }
};

const performanceMode = {
  shouldReduceMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  detectLowSpec() {
    const cpuCores = navigator.hardwareConcurrency ?? 8;
    const deviceMemory = navigator.deviceMemory ?? 8;
    return cpuCores <= 4 || deviceMemory <= 4;
  },

  shouldDisableStarAnimation() {
    return this.shouldReduceMotion() || this.detectLowSpec();
  },

  applyStarAnimationMode() {
    const disableStarAnimation = this.shouldDisableStarAnimation();
    document.body.classList.toggle('reduced-effects', disableStarAnimation);
    if (!disableStarAnimation) {
      effects.applyStarField();
    }
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

const bindEvents = () => {
  cardFanBehavior?.bindInteractions({
    isLocked: () => menu.classList.contains('rerolling'),
    onCardSelected: (card, renderedCards) => {
      menu.classList.add('selecting');
      renderedCards.forEach((c) => c.classList.remove('active'));
      card.classList.add('active');

      overlay.classList.add('play');

      const targetPath = ROUTE_PATHS[card.dataset.route];
      setTimeout(() => {
        overlay.classList.remove('play');
        if (targetPath) {
          window.location.href = targetPath;
        }
      }, UI.rerollOverlayMs);
    }
  });

  eggButton.addEventListener('click', () => reroll.play());
  window.addEventListener('resize', () => layout.layoutCards());
};

const bootstrap = () => {
  initializeCards();
  bindEvents();
  performanceMode.applyStarAnimationMode();
  layout.layoutCards();
};

bootstrap();
