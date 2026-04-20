const worldGenerationForm = document.getElementById('worldGenerationForm');

const worldWidthInput = document.getElementById('worldWidthInput');
const worldHeightInput = document.getElementById('worldHeightInput');
const worldSeedInput = document.getElementById('worldSeedInput');
const seaLevelRatioInput = document.getElementById('seaLevelRatioInput');
const elevationScaleInput = document.getElementById('elevationScaleInput');
const warpStrengthInput = document.getElementById('warpStrengthInput');
const ridgeStrengthInput = document.getElementById('ridgeStrengthInput');
const riverBudgetScaleInput = document.getElementById('riverBudgetScaleInput');

const summaryMapSize = document.getElementById('summaryMapSize');
const summarySeed = document.getElementById('summarySeed');
const summarySeaLevel = document.getElementById('summarySeaLevel');
const summaryElevation = document.getElementById('summaryElevation');
const summaryWarp = document.getElementById('summaryWarp');
const summaryRidge = document.getElementById('summaryRidge');
const summaryRiver = document.getElementById('summaryRiver');

const tabs = Array.from(document.querySelectorAll('.world-tab'));
const tabPanels = Array.from(document.querySelectorAll('.world-tab-panel'));
const selectableCards = Array.from(document.querySelectorAll('.option-card[data-group]'));

const updateSummary = () => {
  summaryMapSize.textContent = `${worldWidthInput.value}×${worldHeightInput.value}`;
  summarySeed.textContent = worldSeedInput.disabled || !worldSeedInput.value.trim() ? '랜덤' : worldSeedInput.value.trim();
  summarySeaLevel.textContent = `${Math.round(Number(seaLevelRatioInput.value) * 100)}%`;
  summaryElevation.textContent = `${Number(elevationScaleInput.value).toFixed(2)}x`;
  summaryWarp.textContent = String(Math.round(Number(warpStrengthInput.value)));
  summaryRidge.textContent = Number(ridgeStrengthInput.value).toFixed(2);
  summaryRiver.textContent = `${Number(riverBudgetScaleInput.value).toFixed(2)}x`;
};

const setSelectedCard = (group, selectedCard) => {
  selectableCards.forEach((card) => {
    if (card.dataset.group === group) {
      card.classList.toggle('is-selected', card === selectedCard);
    }
  });
};

const setSeedMode = (mode) => {
  const fixedMode = mode === 'fixed';
  worldSeedInput.disabled = !fixedMode;
  worldSeedInput.placeholder = fixedMode ? '숫자 시드 입력' : '랜덤 시드 사용 중';
  if (!fixedMode) {
    worldSeedInput.value = '';
  }
};

selectableCards.forEach((card) => {
  card.addEventListener('click', () => {
    const { group } = card.dataset;
    setSelectedCard(group, card);

    if (group === 'map-size') {
      worldWidthInput.value = card.dataset.width;
      worldHeightInput.value = card.dataset.height;
    }

    if (group === 'seed-mode') {
      setSeedMode(card.dataset.seedMode);
    }

    if (group === 'sea-level') {
      seaLevelRatioInput.value = card.dataset.seaLevel;
    }

    if (group === 'elevation') {
      elevationScaleInput.value = card.dataset.elevation;
    }

    if (group === 'warp') {
      warpStrengthInput.value = card.dataset.warp;
    }

    if (group === 'ridge') {
      ridgeStrengthInput.value = card.dataset.ridge;
    }

    if (group === 'river') {
      riverBudgetScaleInput.value = card.dataset.river;
    }

    updateSummary();
  });
});

worldSeedInput?.addEventListener('input', updateSummary);

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const { tab: targetTab } = tab.dataset;
    tabs.forEach((item) => item.classList.toggle('is-active', item === tab));
    tabPanels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panel === targetTab));
  });
});

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
  if (!worldSeedInput.disabled && rawSeed) {
    params.set('seed', rawSeed);
  }

  window.location.href = `./world_map.html?${params.toString()}`;
});

setSeedMode('random');
updateSummary();
