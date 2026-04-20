const worldGenerationForm = document.getElementById('worldGenerationForm');

const worldWidthInput = document.getElementById('worldWidthInput');
const worldHeightInput = document.getElementById('worldHeightInput');
const seaLevelRatioInput = document.getElementById('seaLevelRatioInput');
const elevationScaleInput = document.getElementById('elevationScaleInput');
const warpStrengthInput = document.getElementById('warpStrengthInput');
const ridgeStrengthInput = document.getElementById('ridgeStrengthInput');
const riverBudgetScaleInput = document.getElementById('riverBudgetScaleInput');
const worldSeedInput = document.getElementById('worldSeedInput');

const summaryMapSize = document.getElementById('summaryMapSize');
const summarySeaLevel = document.getElementById('summarySeaLevel');
const summaryTerrain = document.getElementById('summaryTerrain');
const summaryRiver = document.getElementById('summaryRiver');
const summarySeed = document.getElementById('summarySeed');

const tabButtons = [...document.querySelectorAll('.tab-button')];
const tabPanels = [...document.querySelectorAll('.tab-panel')];
const optionCards = [...document.querySelectorAll('.option-card')];

const activateTab = (tabName) => {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  tabPanels.forEach((panel) => {
    const isActive = panel.id === `tab-${tabName}`;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
  });
};

const setActiveCard = (target, activeCard) => {
  optionCards
    .filter((card) => card.dataset.target === target)
    .forEach((card) => card.classList.toggle('active', card === activeCard));
};

const updateSummary = () => {
  summaryMapSize.textContent = `${worldWidthInput.value} x ${worldHeightInput.value}`;
  summarySeaLevel.textContent = `${Math.round(Number(seaLevelRatioInput.value) * 100)}%`;
  summaryTerrain.textContent = `고도 ${Number(elevationScaleInput.value).toFixed(2)}x · 워프 ${Math.round(Number(warpStrengthInput.value))} · 산맥 ${Number(ridgeStrengthInput.value).toFixed(2)}`;
  summaryRiver.textContent = `${Number(riverBudgetScaleInput.value).toFixed(2)}x`;

  const rawSeed = String(worldSeedInput?.value || '').trim();
  summarySeed.textContent = rawSeed || '랜덤';
};

tabButtons.forEach((button) => {
  button.addEventListener('click', () => activateTab(button.dataset.tab));
});

optionCards.forEach((card) => {
  card.addEventListener('click', () => {
    const target = card.dataset.target;
    if (!target) return;

    setActiveCard(target, card);

    if (target === 'mapSize') {
      worldWidthInput.value = card.dataset.width;
      worldHeightInput.value = card.dataset.height;
    }

    if (target === 'seaLevel') {
      seaLevelRatioInput.value = card.dataset.value;
    }

    if (target === 'terrainPreset') {
      elevationScaleInput.value = card.dataset.elevation;
      warpStrengthInput.value = card.dataset.warp;
      ridgeStrengthInput.value = card.dataset.ridge;
    }

    if (target === 'riverBudget') {
      riverBudgetScaleInput.value = card.dataset.value;
    }

    updateSummary();
  });
});

worldSeedInput?.addEventListener('input', updateSummary);

worldGenerationForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(worldGenerationForm);
  const params = new URLSearchParams();
  params.set('gen', '1');
  params.set('width', formData.get('width'));
  params.set('height', formData.get('height'));
  params.set('seaLevelRatio', formData.get('seaLevelRatio'));
  params.set('elevationScale', formData.get('elevationScale'));
  params.set('warpStrength', formData.get('warpStrength'));
  params.set('ridgeStrength', formData.get('ridgeStrength'));
  params.set('riverBudgetScale', formData.get('riverBudgetScale'));

  const rawSeed = String(formData.get('seed') || '').trim();
  if (rawSeed) params.set('seed', rawSeed);

  window.location.href = `./world_map.html?${params.toString()}`;
});

updateSummary();
