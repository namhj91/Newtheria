const worldGenerationForm = document.getElementById('worldGenerationForm');

const seaLevelRatioInput = document.getElementById('seaLevelRatioInput');
const seaLevelRatioValue = document.getElementById('seaLevelRatioValue');
const elevationScaleInput = document.getElementById('elevationScaleInput');
const elevationScaleValue = document.getElementById('elevationScaleValue');
const warpStrengthInput = document.getElementById('warpStrengthInput');
const warpStrengthValue = document.getElementById('warpStrengthValue');
const ridgeStrengthInput = document.getElementById('ridgeStrengthInput');
const ridgeStrengthValue = document.getElementById('ridgeStrengthValue');
const riverBudgetScaleInput = document.getElementById('riverBudgetScaleInput');
const riverBudgetScaleValue = document.getElementById('riverBudgetScaleValue');

const updateLabels = () => {
  seaLevelRatioValue.textContent = `${Math.round(Number(seaLevelRatioInput.value) * 100)}%`;
  elevationScaleValue.textContent = `${Number(elevationScaleInput.value).toFixed(2)}x`;
  warpStrengthValue.textContent = String(Math.round(Number(warpStrengthInput.value)));
  ridgeStrengthValue.textContent = Number(ridgeStrengthInput.value).toFixed(2);
  riverBudgetScaleValue.textContent = `${Number(riverBudgetScaleInput.value).toFixed(2)}x`;
};

[
  seaLevelRatioInput,
  elevationScaleInput,
  warpStrengthInput,
  ridgeStrengthInput,
  riverBudgetScaleInput
].forEach((input) => {
  input?.addEventListener('input', updateLabels);
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
  if (rawSeed) params.set('seed', rawSeed);

  window.location.href = `./world_map.html?${params.toString()}`;
});

updateLabels();
