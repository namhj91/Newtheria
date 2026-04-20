(function attachDialoguePrototype(global) {
  const DEFAULT_DIALOGUES = [
    {
      scene: 'intro',
      anchor: 'start',
      speaker: '???',
      line: '별빛이 잦아드는 밤, 당신의 선택이 새로운 길을 엽니다.',
      backgroundUrl: 'https://picsum.photos/id/1015/1920/1080'
    },
    {
      scene: 'intro',
      anchor: 'choice',
      speaker: '여사제',
      line: '당신은 운명을 믿나요? 아니면 스스로 길을 개척하나요?',
      backgroundUrl: 'https://picsum.photos/id/1025/1920/1080'
    },
    {
      scene: 'intro',
      anchor: 'end',
      speaker: '여사제',
      line: 'CSV에서도 같은 대화 UI로 표시됩니다.',
      backgroundUrl: 'https://picsum.photos/id/1043/1920/1080'
    }
  ];

  const cleanText = (value, fallback = '') => {
    if (value == null) return fallback;
    return String(value).trim();
  };

  const normalizeDialogueRow = (row) => ({
    scene: cleanText(row.scene ?? row.tag ?? row.group ?? row.태그 ?? row.장면 ?? row.씬),
    anchor: cleanText(row.anchor ?? row.id ?? row.key ?? row.앵커 ?? row.포인트),
    speaker: cleanText(row.speaker ?? row.name ?? row.인물명 ?? row.화자, '???'),
    line: cleanText(row.line ?? row.script ?? row.dialogue ?? row.대사),
    backgroundUrl: cleanText(row.backgroundUrl ?? row.background_url ?? row.bg ?? row.배경)
  });

  const selectDialogueSegment = (records, { sceneTag, anchorId } = {}) => {
    let filtered = records;

    if (sceneTag) {
      filtered = filtered.filter((row) => row.scene === sceneTag);
      if (filtered.length === 0) {
        throw new Error(`scene/tag에 해당하는 대사를 찾지 못했습니다: ${sceneTag}`);
      }
    }

    if (anchorId) {
      const anchorIndex = filtered.findIndex((row) => row.anchor === anchorId);
      if (anchorIndex < 0) {
        throw new Error(`anchor에 해당하는 대사를 찾지 못했습니다: ${anchorId}`);
      }
      filtered = filtered.slice(anchorIndex);
    }

    if (filtered.length === 0) {
      throw new Error('선택된 조건에서 표시할 대사가 없습니다.');
    }

    return filtered;
  };

  const parseCsvRows = (csvText) => {
    const rows = [];
    let current = '';
    let row = [];
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i += 1) {
      const char = csvText[i];
      const next = csvText[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        row.push(current);
        current = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') {
          i += 1;
        }
        row.push(current);
        rows.push(row);
        row = [];
        current = '';
        continue;
      }

      current += char;
    }

    if (current.length > 0 || row.length > 0) {
      row.push(current);
      rows.push(row);
    }

    return rows;
  };

  const parseDialoguesFromCsvText = (csvText, { sceneTag, anchorId } = {}) => {
    const rows = parseCsvRows(csvText);
    if (rows.length < 2) {
      throw new Error('CSV 파일에서 헤더/대사 데이터를 찾지 못했습니다.');
    }

    const headers = rows[0].map((header) => cleanText(header));
    const records = rows.slice(1)
      .filter((cells) => cells.some((cell) => cleanText(cell).length > 0))
      .map((cells) => {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = cells[index] ?? '';
        });
        return normalizeDialogueRow(row);
      })
      .filter((row) => row.line.length > 0);

    if (records.length === 0) {
      throw new Error('CSV 파일에서 유효한 대사를 찾지 못했습니다.');
    }

    return selectDialogueSegment(records, { sceneTag, anchorId });
  };

  const loadDialoguesFromCsvUrl = async (csvUrl, options = {}) => {
    const response = await fetch(csvUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`CSV 파일을 불러오지 못했습니다: ${response.status}`);
    }
    const text = await response.text();
    return parseDialoguesFromCsvText(text, options);
  };

  const createDialoguePrototype = ({
    mount,
    dialogues,
    csvUrl,
    sceneTag = '',
    anchorId = '',
    backgroundUrl = '',
    onSkip,
    onError
  } = {}) => {
    if (!mount) {
      throw new Error('dialogue prototype mount 요소가 필요합니다.');
    }

    const root = document.createElement('section');
    root.className = 'dialogue-prototype';
    root.setAttribute('aria-live', 'polite');

    root.innerHTML = `
      <div class="dialogue-prototype__bg" aria-hidden="true">
        <span class="dialogue-prototype__loading">데이터를 로딩 중...</span>
      </div>
      <section class="dialogue-prototype__panel" aria-label="대화창">
        <p class="dialogue-prototype__meta"></p>
        <p class="dialogue-prototype__name"></p>
        <p class="dialogue-prototype__line"></p>
        <button class="dialogue-prototype__next" type="button" aria-label="다음 대사">▼</button>
      </section>
      <button class="dialogue-prototype__skip" type="button">SKIP</button>
    `;

    mount.replaceChildren(root);

    const bg = root.querySelector('.dialogue-prototype__bg');
    const loading = root.querySelector('.dialogue-prototype__loading');
    const metaElement = root.querySelector('.dialogue-prototype__meta');
    const nameElement = root.querySelector('.dialogue-prototype__name');
    const lineElement = root.querySelector('.dialogue-prototype__line');
    const nextButton = root.querySelector('.dialogue-prototype__next');
    const skipButton = root.querySelector('.dialogue-prototype__skip');

    let queue = [];
    let index = 0;

    const setBackground = (url) => {
      const targetUrl = url || backgroundUrl;
      if (!bg) return;
      if (!targetUrl) {
        if (loading) loading.hidden = true;
        return;
      }

      if (loading) {
        loading.hidden = false;
        loading.textContent = '배경 이미지 로딩 중...';
      }

      const image = new Image();
      image.onload = () => {
        bg.style.backgroundImage = `linear-gradient(to top, rgba(0, 0, 0, 0.58), rgba(0, 0, 0, 0.18)), url("${targetUrl}")`;
        if (loading) loading.hidden = true;
      };
      image.onerror = () => {
        if (loading) {
          loading.hidden = false;
          loading.textContent = '배경 이미지를 불러오지 못했습니다.';
        }
      };
      image.src = targetUrl;
    };

    const render = () => {
      const current = queue[index];
      if (!current || !nameElement || !lineElement || !metaElement) return;
      const sceneLabel = current.scene ? `[${current.scene}]` : '';
      const anchorLabel = current.anchor ? `#${current.anchor}` : '';
      metaElement.textContent = `${sceneLabel}${sceneLabel && anchorLabel ? ' ' : ''}${anchorLabel}`;
      nameElement.textContent = current.speaker || '???';
      lineElement.textContent = current.line || '';
      setBackground(current.backgroundUrl);
    };

    const applyDialogues = (inputDialogues, options = {}) => {
      const normalized = (Array.isArray(inputDialogues) ? inputDialogues : DEFAULT_DIALOGUES)
        .map(normalizeDialogueRow)
        .filter((row) => row.line.length > 0);
      queue = selectDialogueSegment(normalized.length > 0 ? normalized : DEFAULT_DIALOGUES, {
        sceneTag: options.sceneTag ?? sceneTag,
        anchorId: options.anchorId ?? anchorId
      });
      index = 0;
      render();
    };

    const reportError = (error) => {
      if (loading) {
        loading.hidden = false;
        loading.textContent = error.message || '대사 데이터를 불러오지 못했습니다.';
      }
      if (typeof onError === 'function') {
        onError(error);
      }
    };

    nextButton?.addEventListener('click', () => {
      if (queue.length === 0) return;
      index = (index + 1) % queue.length;
      render();
    });

    skipButton?.addEventListener('click', () => {
      if (typeof onSkip === 'function') {
        onSkip({ root, mount });
        return;
      }
      root.remove();
    });

    if (Array.isArray(dialogues) && dialogues.length > 0) {
      applyDialogues(dialogues);
    } else if (csvUrl) {
      loadDialoguesFromCsvUrl(csvUrl, { sceneTag, anchorId })
        .then((csvDialogues) => applyDialogues(csvDialogues, { sceneTag: '', anchorId: '' }))
        .catch(reportError);
    } else {
      applyDialogues(DEFAULT_DIALOGUES);
    }

    return {
      root,
      setDialogues(nextDialogues, options = {}) {
        applyDialogues(nextDialogues, options);
      },
      async loadFromCsvUrl(nextCsvUrl, options = {}) {
        try {
          const csvDialogues = await loadDialoguesFromCsvUrl(nextCsvUrl, options);
          applyDialogues(csvDialogues, { sceneTag: '', anchorId: '' });
        } catch (error) {
          reportError(error);
        }
      },
      async loadFromCsvFile(file, options = {}) {
        try {
          const text = await file.text();
          const csvDialogues = parseDialoguesFromCsvText(text, options);
          applyDialogues(csvDialogues, { sceneTag: '', anchorId: '' });
        } catch (error) {
          reportError(error);
        }
      },
      destroy() {
        root.remove();
      }
    };
  };

  global.NewtheriaDialoguePrototype = {
    createDialoguePrototype,
    loadDialoguesFromCsvUrl,
    parseDialoguesFromCsvText,
    selectDialogueSegment
  };
})(window);
