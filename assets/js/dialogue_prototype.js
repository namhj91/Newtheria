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

  const parseChoiceDescriptor = (value) => {
    const raw = cleanText(value);
    if (!raw) return null;

    // 단일 권장 문법:
    // 라벨 => scene#anchor
    // (anchor가 비어 있으면 scene 시작점으로 점프)
    const [labelPart = '', targetPart = ''] = raw.split('=>').map((part) => cleanText(part));
    if (!labelPart) return null;
    if (!targetPart) return { label: labelPart, scene: '', anchor: '' };
    const [scene = '', anchor = ''] = targetPart.split('#').map((part) => cleanText(part));
    return { label: labelPart, scene, anchor };
  };

  const parseInlineVariables = (rawValue) => {
    // CSV의 변수 컬럼 예시:
    // playerName=아린; title=별의 방문자
    // 신뢰도:12, faction=은하수
    const raw = cleanText(rawValue);
    if (!raw) return {};

    return raw
      .split(/[;\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .reduce((acc, entry) => {
        const [rawKey = '', ...rawRest] = entry.split(/[:=]/);
        const key = cleanText(rawKey);
        const value = cleanText(rawRest.join('='));
        if (!key) return acc;
        acc[key] = value;
        return acc;
      }, {});
  };

  const applyTemplateVariables = (templateText, variables = {}) => {
    const source = cleanText(templateText, '');
    if (!source) return '';
    // {{key}} 형식 치환: 변수 미존재 시 원문 토큰을 유지해 디버깅 가능하게 한다.
    return source.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (matched, key) => {
      const variableKey = cleanText(key);
      if (!variableKey) return matched;
      if (Object.prototype.hasOwnProperty.call(variables, variableKey)) {
        return cleanText(variables[variableKey], '');
      }
      return matched;
    });
  };

  const parseChoiceList = (rawValue = '') => cleanText(rawValue)
    .split('||')
    .map((entry) => parseChoiceDescriptor(entry))
    .filter((choice) => choice?.label);

  const normalizeDialogueRow = (row) => ({
    // scene: 대사 묶음(챕터/상황) 식별자
    scene: pick(row, ['태그', 'scene']),
    // anchor: scene 내부의 시작 지점 식별자(재진입/분기 점프 기준)
    anchor: pick(row, ['앵커', 'anchor']),
    speaker: pick(row, ['화자', '인물명', 'speaker'], '???'),
    line: pick(row, ['대사', 'line']),
    backgroundUrl: pick(row, ['배경', 'backgroundUrl']),
    // 변수 컬럼(vars/variables/변수)에 key=value 목록을 넣으면 줄 단위 템플릿 치환에 사용된다.
    variables: parseInlineVariables(pick(row, ['variables', 'vars', '변수'], '')),
    // 단일 문법 컬럼:
    // - 선택지: "라벨 => scene#anchor || 라벨2 => scene2#anchor2"
    // - 히든선택지: 동일 문법
    choices: Array.isArray(row.choices) ? row.choices : parseChoiceList(pick(row, ['선택지'], '')),
    hiddenChoices: Array.isArray(row.hiddenChoices) ? row.hiddenChoices : parseChoiceList(pick(row, ['히든선택지'], ''))
  });

  const extractChoices = (row, { hidden = false } = {}) => {
    // scene 미기입 시 현재 scene을 기본값으로 사용해 같은 묶음 내 점프를 쉽게 만든다.
    const source = hidden ? (row.hiddenChoices || []) : (row.choices || []);
    return source
      .filter((choice) => choice?.label)
      .map((choice) => ({
        label: choice.label,
        scene: choice.scene || row.scene,
        anchor: choice.anchor || ''
      }));
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
    variables = {},
    showMeta = false,
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
      <div class="dialogue-prototype__drag-overlay" aria-hidden="true"></div>
      <div class="dialogue-prototype__choices" id="dialogueChoices" aria-label="선택지"></div>
      <div class="dialogue-prototype__discard-zone" id="dialogueDiscardZone" aria-hidden="true">
        <span class="discard-icon" aria-hidden="true">🗑</span>
        <span>DISCARD</span>
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
    const panelElement = root.querySelector('.dialogue-prototype__panel');
    const metaElement = root.querySelector('.dialogue-prototype__meta');
    const nameElement = root.querySelector('.dialogue-prototype__name');

    // scene/anchor 메타([intro] #start)는 디버그용 정보라 기본값은 숨김 처리한다.
    if (metaElement) {
      metaElement.hidden = !showMeta;
    }
    const lineElement = root.querySelector('.dialogue-prototype__line');
    const choicesElement = root.querySelector('#dialogueChoices');
    const discardZoneElement = root.querySelector('#dialogueDiscardZone');
    const nextButton = root.querySelector('.dialogue-prototype__next');
    const skipButton = root.querySelector('.dialogue-prototype__skip');

    let allRecords = [...DEFAULT_DIALOGUES];
    let queue = [];
    let index = 0;
    let currentFilters = { sceneTag, anchorId };
    let sharedVariables = { ...variables };
    let isChoiceStep = false;
    let choiceFanBehavior = null;
    let choiceDiscardController = null;

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

    const playDialogueMotion = () => {
      // 대사 전환 시 패널/텍스트에 짧은 진입 애니메이션을 주어
      // 클릭 피드백이 더 역동적으로 느껴지도록 처리한다.
      if (panelElement) {
        panelElement.classList.remove('is-advancing');
        void panelElement.offsetWidth;
        panelElement.classList.add('is-advancing');
      }
      [metaElement, nameElement, lineElement].forEach((element) => {
        if (!element || element.hidden) return;
        element.classList.remove('is-entering');
        void element.offsetWidth;
        element.classList.add('is-entering');
      });
    };

    const teardownChoiceInteractions = () => {
      // 선택지 갱신/소멸 시 기존 드래그 상태를 정리해 discard 오버레이 잔상을 방지한다.
      choiceFanBehavior?.destroy?.();
      choiceFanBehavior = null;
      if (choiceDiscardController) {
        choiceDiscardController.reset();
      }
      choiceDiscardController = null;
    };

    const createChoiceCardItem = (choice) => {
      // 카드 템플릿 팩토리 입력 규격으로 선택지 정보를 변환한다.
      // renderCardFanCards를 활용해 DOM 생성 경로를 단일화하면
      // 수동 마크업 조합에서 발생하던 실행 불일치를 줄일 수 있다.
      const targetScene = choice.scene || currentFilters.sceneTag || '-';
      const targetAnchor = choice.anchor || 'start';
      return {
        route: `${targetScene}#${targetAnchor}`,
        icon: '✦',
        label: choice.label,
        desc: `${targetScene} · ${targetAnchor}`,
        brand: 'NEWTHERIA',
        sigil: '✦'
      };
    };

    const renderChoices = (choices, context = {}) => {
      const { restoreChoices = choices, hiddenChoices = [], isHiddenMode = false } = context;
      // 기존 선택지 DOM/상태를 전부 폐기한 뒤 템플릿 API로 재생성한다.
      if (!choicesElement) return;
      teardownChoiceInteractions();
      choicesElement.replaceChildren();
      if (choices.length === 0) return;

      const cardTemplateApi = global.NewtheriaCardTemplates;
      const choiceItems = choices.map((choice) => createChoiceCardItem(choice));
      const renderedCards = cardTemplateApi?.renderCardFanCards
        ? cardTemplateApi.renderCardFanCards(choicesElement, choiceItems)
        : [];

      const cards = renderedCards.length > 0
        ? renderedCards
        : (() => {
          // 템플릿 스크립트가 없는 환경에서는 최소 버튼 UI로 폴백한다.
          return choices.map((choice) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'dialogue-prototype__choice dialogue-prototype__choice--fallback';
            button.textContent = choice.label;
            choicesElement.appendChild(button);
            return button;
          });
        })();

      cards.forEach((card, choiceIndex) => {
        const choice = choices[choiceIndex];
        if (!choice) return;
        card.classList.add('dialogue-prototype__choice');
        card.dataset.choiceScene = choice.scene || currentFilters.sceneTag || '';
        card.dataset.choiceAnchor = choice.anchor || '';
        card.style.setProperty('--choice-delay', `${choiceIndex * 48}ms`);
      });

      if (!cardTemplateApi?.createCardFanBehavior || !cardTemplateApi?.createDiscardZoneController || renderedCards.length === 0) {
        cards.forEach((button) => {
          button.addEventListener('click', () => {
            applySelection({
              sceneTag: button.dataset.choiceScene || currentFilters.sceneTag,
              anchorId: button.dataset.choiceAnchor || ''
            });
          });
        });
        return;
      }

      choiceFanBehavior = cardTemplateApi.createCardFanBehavior({
        menu: choicesElement,
        cards: renderedCards
      });
      choiceDiscardController = cardTemplateApi.createDiscardZoneController({
        zone: discardZoneElement,
        documentBody: root,
        revealDistancePx: 120,
        activeClassName: 'is-drag-discard-active',
        visibleClassName: 'is-drag-discard-visible'
      });

      choiceFanBehavior.bindInteractions({
        shouldDiscardDrop: ({ event }) => choiceDiscardController?.shouldDiscardDrop({ event }) || false,
        onDragStateChange: (isDragging) => {
          choiceDiscardController?.onDragStateChange(isDragging);
        },
        onDragMove: ({ event, moved }) => {
          choiceDiscardController?.onDragMove({ event, moved });
        },
        onCardDiscarded: (_, remainingCards) => {
          if (remainingCards.length !== 0) return;
          // 모든 카드를 버리면 히든 선택지 우선, 없으면 기본 선택지로 복구한다.
          if (!isHiddenMode && hiddenChoices.length > 0) {
            renderChoices(hiddenChoices, {
              restoreChoices,
              hiddenChoices,
              isHiddenMode: true
            });
            return;
          }
          renderChoices(restoreChoices, {
            restoreChoices,
            hiddenChoices,
            isHiddenMode: false
          });
        },
        onCardSelected: (card, allCards) => {
          cardTemplateApi.setActiveCard(allCards, card);
          applySelection({
            sceneTag: card.dataset.choiceScene || currentFilters.sceneTag,
            anchorId: card.dataset.choiceAnchor || ''
          });
        }
      });
      choiceFanBehavior.layoutCards();
    };

    const render = () => {
      // UI의 단일 렌더 진입점.
      // 메타(scene/anchor), 화자, 대사, 배경, 선택지를 한 번에 갱신한다.
      const current = queue[index];
      if (!current || !nameElement || !lineElement) return;
      if (showMeta && metaElement) {
        const sceneLabel = current.scene ? `[${current.scene}]` : '';
        const anchorLabel = current.anchor ? `#${current.anchor}` : '';
        metaElement.textContent = `${sceneLabel}${sceneLabel && anchorLabel ? ' ' : ''}${anchorLabel}`;
      }
      // 기본 변수 + 줄 단위 변수 + 시스템 변수(화자/씬/앵커)를 병합해 템플릿 치환에 사용한다.
      const templateVariables = {
        ...sharedVariables,
        ...(current.variables || {}),
        speaker: current.speaker || '???',
        currentSpeaker: current.speaker || '???',
        상대이름: current.speaker || '???',
        scene: current.scene || '',
        anchor: current.anchor || ''
      };
      nameElement.textContent = applyTemplateVariables(current.speaker || '???', templateVariables);
      lineElement.textContent = applyTemplateVariables(current.line || '', templateVariables);
      setBackground(current.backgroundUrl);
      const choices = extractChoices(current)
        .map((choice) => ({
          ...choice,
          label: applyTemplateVariables(choice.label, templateVariables)
        }));
      const hiddenChoices = extractChoices(current, { hidden: true })
        .map((choice) => ({
          ...choice,
          label: applyTemplateVariables(choice.label, templateVariables)
        }));
      isChoiceStep = choices.length > 0;
      renderChoices(choices, {
        restoreChoices: choices,
        hiddenChoices,
        isHiddenMode: false
      });
      playDialogueMotion();
      if (nextButton) {
        nextButton.style.opacity = isChoiceStep ? '0.58' : '1';
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

    const goNext = () => {
      // 선택지가 열려 있는 구간에서는 임의 진행을 막고,
      // 버튼 선택으로만 분기하도록 보호한다.
      if (queue.length === 0 || isChoiceStep) return;
      index = (index + 1) % queue.length;
      render();
    };

    // 대화 패널 아무 곳이나 눌러도 다음 대사로 진행되도록 처리한다.
    // 단, 선택지 버튼/스킵 버튼 클릭은 개별 동작을 우선시하기 위해 제외한다.
    root.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.dialogue-prototype__choice') || target.closest('.dialogue-prototype__skip')) return;
      goNext();
    });

    nextButton?.addEventListener('click', (event) => {
      event.stopPropagation();
      goNext();
    });

    skipButton?.addEventListener('click', (event) => {
      event.stopPropagation();
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
      setVariables(nextVariables = {}) {
        // 런타임에서 템플릿 변수(예: playerName, faction)를 갱신할 때 사용.
        sharedVariables = { ...sharedVariables, ...nextVariables };
        render();
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
