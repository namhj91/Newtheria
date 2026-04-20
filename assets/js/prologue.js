const initializePrologue = async () => {
  const locale = document.documentElement.lang || 'ko';

  await window.NewtheriaDialogueRepository?.initialize();
  const scene = window.NewtheriaDialogueRepository?.getScene('prologue_intro', locale);

  const goToWorldMap = () => {
    window.location.href = './world_map.html';
  };

  window.NewtheriaDialogueUI?.createDialogueController({
    scene,
    elements: {
      characterName: document.getElementById('goddessName'),
      dialogueText: document.getElementById('dialogueText'),
      nextButton: document.getElementById('nextDialogueButton'),
      skipButton: document.getElementById('skipButton')
    },
    fallbackLabels: {
      next: '다음',
      complete: '여정 시작',
      skip: '스킵'
    },
    onComplete: goToWorldMap,
    onSkip: goToWorldMap
  });
};

initializePrologue();
