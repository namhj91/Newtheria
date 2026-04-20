(function attachCardTemplates(global) {
  const DEFAULT_BACK = {
    orbitClassName: 'orbit',
    sigil: '✦',
    brand: 'AetheriA'
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

  global.NewtheriaCardTemplates = {
    createCardFanCard,
    renderCardFanCards
  };
}(window));
