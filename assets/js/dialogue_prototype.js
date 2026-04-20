(function attachDialoguePrototype(global) {
  // 모듈 단독 실행/테스트 시 사용하는 기본 대사 세트.
  // CSV가 없거나 파싱에 실패했을 때 최소 동작 보장을 위해 유지한다.
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
      line: '어떤 길로 들어가 보시겠어요?',
      backgroundUrl: 'https://picsum.photos/id/1025/1920/1080',
      choice1Label: '1장으로 이동',
      choice1Scene: 'chapter1',
      choice1Anchor: 'start',
      choice2Label: '인트로 마무리',
      choice2Scene: 'intro',
      choice2Anchor: 'end'
    },
    {
      scene: 'intro',
      anchor: 'end',
      speaker: '여사제',
      line: '인트로 대사는 여기까지입니다.',
      backgroundUrl: 'https://picsum.photos/id/1043/1920/1080'
    },
    {
      scene: 'chapter1',
      anchor: 'start',
      speaker: '기록관',
      line: '1장으로 넘어왔습니다.',
      backgroundUrl: 'https://picsum.photos/id/1039/1920/1080'
    }
  ];

  const cleanText = (value, fallback = '') => {
    if (value == null) return fallback;
    return String(value).trim();
  };

  const pick = (row, keys, fallback = '') => {
    // 같은 의미의 헤더를 여러 이름(영문/한글)으로 지원하기 위한 우선순위 선택기.
    for (const key of keys) {
      if (row[key] != null && String(row[key]).trim().length > 0) {
        return cleanText(row[key]);
      }
    }
    return fallback;
  };

  const normalizeDialogueRow = (row) => ({
    // scene: 대사 묶음(챕터/상황) 식별자
    scene: pick(row, ['scene', 'tag', 'group', '태그', '장면', '씬']),
    // anchor: scene 내부의 시작 지점 식별자(재진입/분기 점프 기준)
    anchor: pick(row, ['anchor', 'id', 'key', '앵커', '포인트']),
    speaker: pick(row, ['speaker', 'name', '인물명', '화자'], '???'),
    line: pick(row, ['line', 'script', 'dialogue', '대사']),
    backgroundUrl: pick(row, ['backgroundUrl', 'background_url', 'bg', '배경']),
    choice1Label: pick(row, ['choice1Label', 'choice_1_label', '선택지1', '분기1라벨']),
    choice1Scene: pick(row, ['choice1Scene', 'choice_1_scene', '선택지1씬', '분기1씬']),
    choice1Anchor: pick(row, ['choice1Anchor', 'choice_1_anchor', '선택지1앵커', '분기1앵커']),
    choice2Label: pick(row, ['choice2Label', 'choice_2_label', '선택지2', '분기2라벨']),
    choice2Scene: pick(row, ['choice2Scene', 'choice_2_scene', '선택지2씬', '분기2씬']),
    choice2Anchor: pick(row, ['choice2Anchor', 'choice_2_anchor', '선택지2앵커', '분기2앵커']),
    choice3Label: pick(row, ['choice3Label', 'choice_3_label', '선택지3', '분기3라벨']),
    choice3Scene: pick(row, ['choice3Scene', 'choice_3_scene', '선택지3씬', '분기3씬']),
    choice3Anchor: pick(row, ['choice3Anchor', 'choice_3_anchor', '선택지3앵커', '분기3앵커'])
  });

  const extractChoices = (row) => {
    // 한 줄(row)에서 최대 3개의 선택지를 추출한다.
    // scene 미기입 시 현재 scene을 기본값으로 사용해 같은 묶음 내 점프를 쉽게 만든다.
    const choices = [];
    for (let i = 1; i <= 3; i += 1) {
      const label = row[`choice${i}Label`];
      const scene = row[`choice${i}Scene`] || row.scene;
      const anchor = row[`choice${i}Anchor`];
      if (!label) continue;
      choices.push({ label, scene, anchor });
    }
    return choices;
  };

  const selectDialogueSegment = (records, { sceneTag, anchorId } = {}) => {
    // 1) scene(tag) 필터 -> 2) anchor부터 슬라이스
    // 저장/불러오기 또는 이벤트 재진입 시 동일 규칙으로 대사 구간을 가져오기 위한 공통 함수.
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
    // 따옴표/콤마/개행을 처리하는 경량 CSV 파서.
    // 외부 라이브러리 의존 없이 테스트 환경에서도 동작하도록 직접 구현.
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
        if (char === '\r' && next === '\n') i += 1;
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

  const parseAllDialoguesFromCsvText = (csvText) => {
    // CSV 원문을 "정규화된 전체 대사 레코드 배열"로 변환한다.
    // 분기 점프를 위해 전체 레코드를 보관해야 하므로, 이 함수는 필터링하지 않는다.
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

    return records;
  };

  const parseDialoguesFromCsvText = (csvText, options = {}) => {
    // 외부 공개 API: CSV 텍스트 -> (scene/anchor 조건 반영된) 표시용 대사 구간.
    const records = parseAllDialoguesFromCsvText(csvText);
    return selectDialogueSegment(records, options);
  };

  const loadDialoguesFromCsvUrl = async (csvUrl, options = {}) => {
    // 외부 공개 API: CSV URL에서 바로 로딩 + 필터링.
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
    // 외부 공개 API: mount 요소 내부에 대화 프로토타입 UI를 생성한다.
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
        <div class="dialogue-prototype__choices" id="dialogueChoices"></div>
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
    const choicesElement = root.querySelector('#dialogueChoices');
    const nextButton = root.querySelector('.dialogue-prototype__next');
    const skipButton = root.querySelector('.dialogue-prototype__skip');

    let allRecords = [...DEFAULT_DIALOGUES];
    let queue = [];
    let index = 0;
    let currentFilters = { sceneTag, anchorId };

    const setBackground = (url) => {
      // 줄 단위 배경 -> 기본 배경 순으로 적용.
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

    const applySelection = (filters = {}) => {
      // 현재 전체 레코드에서 scene/anchor 조건으로 표시 큐를 재구성한다.
      // 분기 선택지 클릭, 외부 jumpTo, 초기 진입 모두 이 함수를 사용한다.
      currentFilters = {
        sceneTag: filters.sceneTag ?? currentFilters.sceneTag,
        anchorId: filters.anchorId ?? currentFilters.anchorId
      };
      queue = selectDialogueSegment(allRecords, currentFilters);
      index = 0;
      render();
    };

    const renderChoices = (choices) => {
      // 현재 줄에 선택지가 있으면 버튼을 생성하고,
      // 클릭 시 지정된 scene/anchor로 즉시 점프한다.
      if (!choicesElement) return;
      choicesElement.replaceChildren();
      if (choices.length === 0) return;

      const fragment = document.createDocumentFragment();
      choices.forEach((choice) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dialogue-prototype__choice';
        button.textContent = choice.label;
        button.addEventListener('click', () => {
          applySelection({
            sceneTag: choice.scene || currentFilters.sceneTag,
            anchorId: choice.anchor || ''
          });
        });
        fragment.appendChild(button);
      });
      choicesElement.appendChild(fragment);
    };

    const render = () => {
      // UI의 단일 렌더 진입점.
      // 메타(scene/anchor), 화자, 대사, 배경, 선택지를 한 번에 갱신한다.
      const current = queue[index];
      if (!current || !nameElement || !lineElement || !metaElement) return;
      const sceneLabel = current.scene ? `[${current.scene}]` : '';
      const anchorLabel = current.anchor ? `#${current.anchor}` : '';
      metaElement.textContent = `${sceneLabel}${sceneLabel && anchorLabel ? ' ' : ''}${anchorLabel}`;
      nameElement.textContent = current.speaker || '???';
      lineElement.textContent = current.line || '';
      setBackground(current.backgroundUrl);
      const choices = extractChoices(current);
      renderChoices(choices);
      if (nextButton) {
        nextButton.style.opacity = choices.length > 0 ? '0.58' : '1';
      }
    };

    const setAllRecords = (records, filters = {}) => {
      // 외부 데이터 교체 시 전체 레코드를 저장하고, 현재 필터로 즉시 재선택/렌더한다.
      allRecords = records
        .map(normalizeDialogueRow)
        .filter((row) => row.line.length > 0);
      if (allRecords.length === 0) {
        allRecords = [...DEFAULT_DIALOGUES];
      }
      applySelection({
        sceneTag: filters.sceneTag ?? sceneTag,
        anchorId: filters.anchorId ?? anchorId
      });
    };

    const reportError = (error) => {
      // 사용자 화면(로딩 텍스트)과 개발자 콜백(onError)을 동시에 갱신하는 공통 에러 처리기.
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
      setAllRecords(dialogues);
    } else if (csvUrl) {
      fetch(csvUrl, { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`CSV 파일을 불러오지 못했습니다: ${response.status}`);
          }
          return response.text();
        })
        .then((text) => {
          const records = parseAllDialoguesFromCsvText(text);
          setAllRecords(records);
        })
        .catch(reportError);
    } else {
      setAllRecords(DEFAULT_DIALOGUES);
    }

    return {
      root,
      setDialogues(nextDialogues, filters = {}) {
        // 런타임에서 대사 배열을 직접 주입할 때 사용.
        setAllRecords(Array.isArray(nextDialogues) ? nextDialogues : DEFAULT_DIALOGUES, filters);
      },
      async loadFromCsvUrl(nextCsvUrl, filters = {}) {
        // 런타임에서 URL 기반 CSV를 다시 불러올 때 사용.
        try {
          const response = await fetch(nextCsvUrl, { cache: 'no-store' });
          if (!response.ok) {
            throw new Error(`CSV 파일을 불러오지 못했습니다: ${response.status}`);
          }
          const text = await response.text();
          const records = parseAllDialoguesFromCsvText(text);
          setAllRecords(records, filters);
        } catch (error) {
          reportError(error);
        }
      },
      async loadFromCsvFile(file, filters = {}) {
        // 런타임에서 로컬 CSV 파일(File API)을 직접 업로드할 때 사용.
        try {
          const text = await file.text();
          const records = parseAllDialoguesFromCsvText(text);
          setAllRecords(records, filters);
        } catch (error) {
          reportError(error);
        }
      },
      jumpTo({ sceneTag: nextSceneTag, anchorId: nextAnchorId } = {}) {
        // 외부에서 강제 점프(예: 이벤트/퀘스트 연동)를 수행할 때 사용.
        applySelection({ sceneTag: nextSceneTag, anchorId: nextAnchorId });
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
