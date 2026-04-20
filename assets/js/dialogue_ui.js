window.NewtheriaDialogueUI = {
  createDialogueController({
    scene,
    elements,
    fallbackLabels = {},
    onComplete = () => {},
    onSkip = null
  }) {
    const lines = Array.isArray(scene?.lines) && scene.lines.length > 0 ? scene.lines : ['...'];
    const nextLabel = scene?.nextLabel || fallbackLabels.next || '다음';
    const completeLabel = scene?.completeLabel || fallbackLabels.complete || '완료';
    const skipLabel = scene?.skipLabel || fallbackLabels.skip || '건너뛰기';

    if (elements.characterName && scene?.characterName) {
      elements.characterName.textContent = scene.characterName;
    }

    if (elements.skipButton) {
      elements.skipButton.textContent = skipLabel;
    }

    let lineIndex = 0;

    const render = () => {
      if (elements.dialogueText) {
        elements.dialogueText.textContent = lines[lineIndex] ?? lines[lines.length - 1];
      }

      if (elements.nextButton) {
        elements.nextButton.textContent = lineIndex >= lines.length - 1 ? completeLabel : nextLabel;
      }
    };

    const advance = () => {
      if (lineIndex >= lines.length - 1) {
        onComplete();
        return;
      }

      lineIndex += 1;
      render();
    };

    const skip = () => {
      if (typeof onSkip === 'function') {
        onSkip();
      } else {
        onComplete();
      }
    };

    elements.nextButton?.addEventListener('click', advance);
    elements.skipButton?.addEventListener('click', skip);

    render();

    return {
      render,
      advance,
      skip
    };
  }
};
