(function attachDialogueTemplate(global) {
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

  const cleanAnchorToken = (value) => {
    // 앵커/씬 토큰 뒤에 붙은 세미콜론/쉼표/인라인 메모를 정리한다.
    // 예: "start;", "start ; 임시메모", "start, "
    const normalized = cleanText(value);
    if (!normalized) return '';
    return normalized
      .replace(/\s*[;,]\s*$/g, '')
      .replace(/\s+(?:\/\/|;).+$/g, '')
      .trim();
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

    // 선택지 한 칸 안에서 부가 메타를 읽는다.
    // 예: "돕는다 => intro#help [조건:신뢰도>=10] [효과:신뢰도+2;평판+1]"
    const metadata = {};
    const normalized = raw.replace(/\[([^\]:]+)\s*:\s*([^\]]+)\]/g, (_, key, body) => {
      const metaKey = cleanText(key).toLowerCase();
      const metaValue = cleanText(body);
      if (metaKey && metaValue) metadata[metaKey] = metaValue;
      return '';
    }).trim();

    // 단일 권장 문법:
    // 라벨 => scene#anchor
    // (anchor가 비어 있으면 scene 시작점으로 점프)
    const [labelPart = '', targetPart = ''] = normalized.split('=>').map((part) => cleanText(part));
    if (!labelPart) return null;
    const condition = metadata['조건'] || metadata.condition || '';
    const effect = metadata['효과'] || metadata.effect || metadata.effects || '';
    const parsedEffects = parseEffectList(effect);
    if (!targetPart) {
      return { label: labelPart, scene: '', anchor: '', condition, effects: parsedEffects };
    }
    const [scene = '', anchor = ''] = targetPart.split('#').map((part) => cleanAnchorToken(part));
    return { label: labelPart, scene, anchor, condition, effects: parsedEffects };
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

  const parseScalarValue = (rawValue) => {
    const value = cleanText(rawValue);
    if (!value) return '';
    const lower = value.toLowerCase();
    if (['true', '예', 'yes', 'y', 'on'].includes(lower)) return true;
    if (['false', '아니오', 'no', 'n', 'off'].includes(lower)) return false;
    if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
    return value;
  };

  const parseBooleanLike = (rawValue) => {
    const value = cleanText(rawValue).toLowerCase();
    if (!value) return false;
    return ['1', 'true', '예', 'yes', 'y', 'on', 'end', 'stop', '종료'].includes(value);
  };

  const parseAudioDirective = (rawValue = '', { defaultLoop = false } = {}) => {
    // 오디오 문법:
    // 1) "stop" / "off" / "정지"
    // 2) "play|url|0.7|loop" (action|url|volume|loop)
    // 3) "url" (재생으로 간주)
    const source = cleanText(rawValue);
    if (!source) return null;
    const lowered = source.toLowerCase();
    if (['stop', 'off', '정지', '중지'].includes(lowered)) {
      return { action: 'stop' };
    }

    const parts = source.split('|').map((part) => cleanText(part));
    if (parts.length > 1) {
      const [actionRaw = 'play', urlRaw = '', volumeRaw = '', loopRaw = ''] = parts;
      const action = cleanText(actionRaw).toLowerCase() || 'play';
      if (action === 'stop') return { action: 'stop' };
      return {
        action: 'play',
        url: urlRaw,
        volume: volumeRaw ? Math.max(0, Math.min(1, Number(volumeRaw))) : undefined,
        loop: loopRaw ? parseBooleanLike(loopRaw) : defaultLoop
      };
    }

    return {
      action: 'play',
      url: source,
      loop: defaultLoop
    };
  };

  const parseNumberLike = (rawValue, fallback = 0) => {
    const value = Number(cleanText(rawValue));
    return Number.isFinite(value) ? value : fallback;
  };

  const parseUiDirective = (rawValue = '') => {
    // UI 문법(세미콜론 구분):
    // hud=off;name=off;choices=lock;skip=off
    const source = cleanText(rawValue);
    if (!source) return {};
    return source
      .split(/[;\n,]/)
      .map((entry) => cleanText(entry))
      .filter(Boolean)
      .reduce((acc, entry) => {
        const [keyRaw = '', valueRaw = ''] = entry.split('=');
        const key = cleanText(keyRaw).toLowerCase();
        const value = cleanText(valueRaw).toLowerCase();
        if (!key) return acc;
        acc[key] = value || 'on';
        return acc;
      }, {});
  };

  const parseCameraDirective = (rawValue = '') => {
    // 카메라 문법:
    // pan(12,-8,400);zoom(1.08,320) / reset
    const source = cleanText(rawValue);
    if (!source) return [];
    if (source.toLowerCase() === 'reset') {
      return [{ action: 'reset' }];
    }
    return source
      .split(/[;\n]/)
      .map((entry) => cleanText(entry))
      .filter(Boolean)
      .map((entry) => {
        const panMatch = entry.match(/^pan\(([-\d.]+)\s*,\s*([-\d.]+)(?:\s*,\s*(\d+))?\)$/i);
        if (panMatch) {
          return {
            action: 'pan',
            x: Number(panMatch[1]),
            y: Number(panMatch[2]),
            durationMs: Number(panMatch[3] || 360)
          };
        }
        const zoomMatch = entry.match(/^zoom\(([-\d.]+)(?:\s*,\s*(\d+))?\)$/i);
        if (zoomMatch) {
          return {
            action: 'zoom',
            scale: Number(zoomMatch[1]),
            durationMs: Number(zoomMatch[2] || 320)
          };
        }
        return null;
      })
      .filter(Boolean);
  };

  const parseParticleDirective = (rawValue = '') => {
    // 파티클 문법: snow:on / ember:on / off
    const source = cleanText(rawValue);
    if (!source) return { mode: '' };
    if (source.toLowerCase() === 'off') {
      return { mode: 'off' };
    }
    const match = source.match(/^([a-zA-Z가-힣_-]+)\s*[:=]\s*(on|off)$/);
    if (match) {
      return { mode: match[1].toLowerCase(), enabled: match[2].toLowerCase() === 'on' };
    }
    return { mode: source.toLowerCase(), enabled: true };
  };

  const parseLightDirective = (rawValue = '') => {
    // 조명 문법: tint(#88aaff,0.24,400) / off
    const source = cleanText(rawValue);
    if (!source) return null;
    if (source.toLowerCase() === 'off') return { action: 'off' };
    const tintMatch = source.match(/^tint\(\s*([^,]+)\s*,\s*([-\d.]+)(?:\s*,\s*(\d+))?\s*\)$/i);
    if (tintMatch) {
      return {
        action: 'tint',
        color: cleanText(tintMatch[1]),
        alpha: Math.max(0, Math.min(1, Number(tintMatch[2]))),
        durationMs: Number(tintMatch[3] || 360)
      };
    }
    return null;
  };

  const parseStandingDirective = (rawValue = '') => {
    // 스탠딩 문법(세미콜론 구분):
    // 좌=url|이름|move(18,0,280)|flip
    // 우=url|이름|move(-12,0,280)|auto
    // 화자=좌
    // clear / off
    const source = cleanText(rawValue);
    if (!source) return null;
    const lowered = source.toLowerCase();
    if (['off', 'clear', 'reset', 'none'].includes(lowered)) {
      return { clear: true, slots: {}, activeSlot: '' };
    }

    const standing = { clear: false, slots: {}, activeSlot: '' };
    source
      .split(/[;\n]/)
      .map((entry) => cleanText(entry))
      .filter(Boolean)
      .forEach((entry) => {
        const [rawKey = '', ...rawRest] = entry.split('=');
        const key = cleanText(rawKey).toLowerCase();
        const body = cleanText(rawRest.join('='));
        if (!key || !body) return;

        if (['화자', 'active', 'speaker'].includes(key)) {
          standing.activeSlot = ['좌', 'left', 'l'].includes(body.toLowerCase())
            ? 'left'
            : (['우', 'right', 'r'].includes(body.toLowerCase()) ? 'right' : '');
          return;
        }

        const slot = ['좌', 'left', 'l'].includes(key)
          ? 'left'
          : (['우', 'right', 'r'].includes(key) ? 'right' : '');
        if (!slot) return;

        const [urlRaw = '', nameRaw = '', motionRaw = '', facingRaw = '', ...metaParts] = body.split('|').map((part) => cleanText(part));
        const moveMatch = motionRaw.match(/^move\(([-\d.]+)\s*,\s*([-\d.]+)(?:\s*,\s*(\d+))?\)$/i);
        const standingId = metaParts
          .map((part) => part.match(/^(?:id|tag|키)\s*[:=]\s*(.+)$/i))
          .find(Boolean)?.[1]?.trim() || '';
        standing.slots[slot] = {
          url: urlRaw,
          name: nameRaw,
          id: standingId,
          motion: moveMatch ? 'move' : motionRaw.toLowerCase(),
          moveX: moveMatch ? Number(moveMatch[1]) : 0,
          moveY: moveMatch ? Number(moveMatch[2]) : 0,
          durationMs: moveMatch ? Number(moveMatch[3] || 280) : 280,
          facing: facingRaw.toLowerCase()
        };
      });
    return standing;
  };

  const parseTransitionDirective = (rawValue = '') => {
    // 전환 문법: fade-black(500) / fade-white(360)
    const source = cleanText(rawValue);
    if (!source) return null;
    const match = source.match(/^(fade-black|fade-white)\((\d+)\)$/i);
    if (!match) return null;
    return {
      action: cleanText(match[1]).toLowerCase(),
      durationMs: Number(match[2])
    };
  };

  const parseHapticDirective = (rawValue = '') => {
    // 진동 문법: light / medium / heavy / custom(40,80,40)
    const source = cleanText(rawValue);
    if (!source) return null;
    const lower = source.toLowerCase();
    if (['light', 'medium', 'heavy'].includes(lower)) return { pattern: lower };
    const customMatch = source.match(/^custom\(([\d,\s]+)\)$/i);
    if (customMatch) {
      return {
        pattern: customMatch[1]
          .split(',')
          .map((v) => Number(cleanText(v)))
          .filter((v) => Number.isFinite(v) && v >= 0)
      };
    }
    return null;
  };

  const splitByTopLevelToken = (source, tokens) => {
    const fragments = [];
    let current = '';
    let depth = 0;
    let cursor = 0;
    while (cursor < source.length) {
      const char = source[cursor];
      if (char === '(') depth += 1;
      if (char === ')') depth = Math.max(0, depth - 1);
      if (depth === 0) {
        const matched = tokens.find((token) => source.startsWith(token, cursor));
        if (matched) {
          fragments.push(cleanText(current));
          current = '';
          cursor += matched.length;
          continue;
        }
      }
      current += char;
      cursor += 1;
    }
    fragments.push(cleanText(current));
    return fragments.filter(Boolean);
  };

  const evaluateComparison = (expression, variables = {}) => {
    const source = cleanText(expression);
    if (!source) return true;
    const match = source.match(/^(.*?)\s*(>=|<=|==|!=|>|<)\s*(.*?)$/);
    if (!match) {
      if (Object.prototype.hasOwnProperty.call(variables, source)) {
        return Boolean(variables[source]);
      }
      return parseBooleanLike(source);
    }
    const [, rawLeft = '', operator = '', rawRight = ''] = match;
    const leftKey = cleanText(rawLeft);
    const left = Object.prototype.hasOwnProperty.call(variables, leftKey) ? variables[leftKey] : parseScalarValue(leftKey);
    const rightKey = cleanText(rawRight);
    const right = Object.prototype.hasOwnProperty.call(variables, rightKey) ? variables[rightKey] : parseScalarValue(rightKey);

    switch (operator) {
      case '>=': return Number(left) >= Number(right);
      case '<=': return Number(left) <= Number(right);
      case '>': return Number(left) > Number(right);
      case '<': return Number(left) < Number(right);
      case '==': return String(left) === String(right);
      case '!=': return String(left) !== String(right);
      default: return false;
    }
  };

  const evaluateConditionExpression = (condition, variables = {}) => {
    const source = cleanText(condition);
    if (!source) return true;
    const normalized = source
      .replace(/\s+그리고\s+/g, '&&')
      .replace(/\s+또는\s+/g, '||')
      .replace(/\s+AND\s+/gi, '&&')
      .replace(/\s+OR\s+/gi, '||')
      .trim();

    const orParts = splitByTopLevelToken(normalized, ['||']);
    if (orParts.length > 1) {
      return orParts.some((part) => evaluateConditionExpression(part, variables));
    }

    const andParts = splitByTopLevelToken(normalized, ['&&']);
    if (andParts.length > 1) {
      return andParts.every((part) => evaluateConditionExpression(part, variables));
    }

    const notMatch = normalized.match(/^NOT\((.*)\)$/i);
    if (notMatch) {
      return !evaluateConditionExpression(notMatch[1], variables);
    }

    if (normalized.startsWith('(') && normalized.endsWith(')')) {
      return evaluateConditionExpression(normalized.slice(1, -1), variables);
    }

    return evaluateComparison(normalized, variables);
  };

  const parseEffectList = (rawValue = '') => {
    const source = cleanText(rawValue);
    if (!source) return [];
    return source
      .split(/[;\n,]/)
      .map((entry) => cleanText(entry))
      .filter(Boolean)
      .map((entry) => {
        const assignMatch = entry.match(/^([^+\-!=:]+?)\s*(\+=|-=|=)\s*(.+)$/);
        if (assignMatch) {
          return {
            key: cleanText(assignMatch[1]),
            operator: assignMatch[2],
            value: parseScalarValue(assignMatch[3])
          };
        }
        const deltaMatch = entry.match(/^([^+\-!=:]+?)\s*([+-])\s*(\d+(?:\.\d+)?)$/);
        if (deltaMatch) {
          return {
            key: cleanText(deltaMatch[1]),
            operator: deltaMatch[2] === '+' ? '+=' : '-=',
            value: Number(deltaMatch[3])
          };
        }
        const toggleMatch = entry.match(/^([^+\-!=:]+?)\s*=\s*!(.+)?$/);
        if (toggleMatch) {
          return {
            key: cleanText(toggleMatch[1]),
            operator: 'toggle'
          };
        }
        return {
          key: cleanText(entry),
          operator: '=',
          value: true
        };
      })
      .filter((effect) => effect.key);
  };

  const applyEffects = (baseVariables = {}, effects = []) => effects.reduce((acc, effect) => {
    const key = effect.key;
    if (!key) return acc;
    const current = acc[key];
    switch (effect.operator) {
      case '+=':
        acc[key] = Number(current || 0) + Number(effect.value || 0);
        break;
      case '-=':
        acc[key] = Number(current || 0) - Number(effect.value || 0);
        break;
      case 'toggle':
        acc[key] = !Boolean(current);
        break;
      case '=':
      default:
        acc[key] = effect.value;
        break;
    }
    return acc;
  }, { ...baseVariables });

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

  const parseChoiceSectionLines = (entries = []) => entries
    .map((entry) => cleanText(entry).replace(/^-\s*/, ''))
    .filter(Boolean)
    .map((entry) => parseChoiceDescriptor(entry))
    .filter((choice) => choice?.label);

  const parseJumpDescriptor = (rawValue = '', { fallbackScene = '' } = {}) => {
    // 선택지 없이 다음 앵커로 이동할 때 사용하는 축약 문법.
    // 예: "intro#ending", "#ending", "chapter2"
    const source = cleanText(rawValue);
    if (!source) return null;
    const [sceneRaw = '', anchorRaw = ''] = source.split('#').map((part) => cleanAnchorToken(part));
    if (!sceneRaw && !anchorRaw) return null;
    return {
      scene: sceneRaw || fallbackScene,
      anchor: anchorRaw || ''
    };
  };

  const normalizeVariableRecord = (value) => {
    // 이미 객체 형태({ playerName: '순례자' })인 변수값은 재파싱하지 않고 그대로 유지한다.
    // CSV 문자열만 parseInlineVariables로 보내 [object Object] 키가 생기는 재정규화 오류를 방지한다.
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.entries(value).reduce((acc, [rawKey, rawValue]) => {
        const key = cleanText(rawKey);
        if (!key) return acc;
        acc[key] = parseScalarValue(rawValue);
        return acc;
      }, {});
    }
    return parseInlineVariables(value);
  };

  const normalizeEffectRecord = (value) => {
    // 이미 파싱된 효과 배열([{key, operator, value}])은 그대로 재사용한다.
    if (Array.isArray(value)) {
      return value
        .map((effect) => {
          if (!effect || typeof effect !== 'object') return null;
          return {
            key: cleanText(effect.key),
            operator: cleanText(effect.operator) || '=',
            value: effect.value
          };
        })
        .filter((effect) => effect?.key);
    }
    return parseEffectList(value);
  };

  const normalizeDialogueRow = (row) => ({
    // scene: 대사 묶음(챕터/상황) 식별자
    scene: pick(row, ['태그', 'scene']),
    // anchor: scene 내부의 시작 지점 식별자(재진입/분기 점프 기준)
    anchor: pick(row, ['앵커', 'anchor']),
    speaker: pick(row, ['화자', '인물명', 'speaker'], '???'),
    // 레거시 호환: 과거 스탠딩 포커스 문법 입력을 파싱만 유지한다(현재 렌더에는 미사용).
    speakerFocus: pick(row, ['화자포커스', '포커스', 'focus', 'speakerFocus']),
    line: pick(row, ['대사', 'line']),
    backgroundUrl: pick(row, ['배경', 'backgroundUrl']),
    // 레거시 호환: 그림 컬럼은 파싱만 유지한다(현재는 배경 레이어만 렌더).
    illustrationUrl: pick(row, ['그림', '일러스트', 'cg', 'image', 'imageUrl']),
    // 레거시 호환: 그림 애니메이션 컬럼 파싱만 유지한다.
    illustrationAnimation: pick(row, ['그림애니메이션', '이미지애니메이션', 'animation', 'imageAnimation']),
    // 레거시 호환: 스탠딩 문법 파싱만 유지한다.
    standing: parseStandingDirective(pick(row, ['스탠딩', 'standing', '스탠딩문법'])),
    // 오디오 레이어 3종:
    // - bgm: 장면 음악(loop 기본 true)
    // - bgs: 환경음(loop 기본 true)
    // - voice: 대사 보이스(loop 기본 false)
    bgm: parseAudioDirective(pick(row, ['bgm', 'BGM', '배경음악']), { defaultLoop: true }),
    bgs: parseAudioDirective(pick(row, ['bgs', 'BGS', '배경환경음']), { defaultLoop: true }),
    voice: parseAudioDirective(pick(row, ['voice', 'VOICE', '보이스']), { defaultLoop: false }),
    // sfx: 원샷 효과음(기본 loop=false)
    sfx: parseAudioDirective(pick(row, ['sfx', 'SFX', '효과음']), { defaultLoop: false }),
    // 자동넘김: 선택지 없는 줄에서 지정 ms 후 자동으로 다음 줄로 진행.
    autoNextMs: parseNumberLike(pick(row, ['자동넘김', 'autoNextMs', 'delayMs']), 0),
    // 화면효과: flash, shake, dim 중 하나. 줄 진입 시 짧게 적용.
    screenFx: pick(row, ['화면효과', 'screenFx']),
    cameraFx: parseCameraDirective(pick(row, ['카메라', 'cameraFx', 'camera'])),
    uiFx: parseUiDirective(pick(row, ['ui', 'UI', 'uiFx'])),
    hapticFx: parseHapticDirective(pick(row, ['진동', 'haptic', 'hapticFx'])),
    particleFx: parseParticleDirective(pick(row, ['파티클', 'particle', 'particleFx'])),
    lightFx: parseLightDirective(pick(row, ['조명', 'light', 'lightFx'])),
    transitionFx: parseTransitionDirective(pick(row, ['씬전환', 'transition', 'transitionFx'])),
    // 변수 컬럼(vars/variables/변수)에 key=value 목록을 넣으면 줄 단위 템플릿 치환에 사용된다.
    variables: normalizeVariableRecord(row.variables ?? row.vars ?? row.변수 ?? ''),
    // 조건/효과/종료는 "비전공자 친화 문법"을 위한 흐름 제어 확장 칼럼.
    condition: pick(row, ['조건', 'condition']),
    effects: normalizeEffectRecord(row.effects ?? row.effect ?? row.효과 ?? ''),
    endDialogue: parseBooleanLike(pick(row, ['종료', 'end', 'stop'], '')),
    // 점프: 선택지 없이 다음 앵커(또는 scene 시작점)로 이동.
    jump: parseJumpDescriptor(pick(row, ['점프', 'jump', '이동'], ''), {
      fallbackScene: pick(row, ['태그', 'scene'])
    }),
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
        anchor: choice.anchor || '',
        condition: choice.condition || '',
        effects: Array.isArray(choice.effects) ? choice.effects : []
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

  const buildRunnableQueue = (records, filters = {}, baseVariables = {}) => {
    // scene/anchor로 자른 구간을 "실제 진행 순서"대로 평가해 실행 가능한 큐를 만든다.
    // 핵심: 줄 조건을 한 번에 정적 필터링하지 않고, 앞줄에서 반영된 변수/효과를
    // 다음 줄 조건 계산에 순차적으로 반영한다.
    const segment = selectDialogueSegment(records, filters);
    const queue = [];
    let simulatedVariables = { ...baseVariables };

    segment.forEach((row) => {
      const mergedVariables = {
        ...simulatedVariables,
        ...(row.variables || {})
      };
      const canEnterRow = evaluateConditionExpression(row.condition, mergedVariables);
      if (!canEnterRow) return;
      queue.push(row);
      simulatedVariables = applyEffects(mergedVariables, row.effects || []);
    });

    return queue;
  };

  const normalizeScriptLineBreaks = (scriptText) => {
    const raw = String(scriptText || '');
    // 일부 입력 경로(메신저/복붙)에서 "\n"이 실제 개행이 아닌 리터럴 문자로 들어올 수 있다.
    // 이런 경우 주석 배너 한 줄 뒤의 @anchor가 같은 물리 라인에 붙어 파서가 통째로 건너뛸 수 있어,
    // "개행 문자가 거의 없고 \\n 토큰이 많은" 케이스에 한해 안전하게 실제 개행으로 복원한다.
    const actualNewlineCount = (raw.match(/\r?\n/g) || []).length;
    const escapedNewlineCount = (raw.match(/\\n/g) || []).length;
    if (actualNewlineCount <= 1 && escapedNewlineCount >= 2) {
      return raw.replace(/\\n/g, '\n');
    }
    return raw;
  };

  const parseAllDialoguesFromScriptText = (scriptText) => {
    // NDS v2 문법(섹션 기반):
    // @scene#anchor
    // [대사출력]
    // 화자 = 아스테리아
    // 대사 = ...
    // [흐름제어]
    // 자동넘김 = 1200
    // 점프 = intro#next
    // [선택지]
    // - 라벨 => intro#next
    // ---
    const normalizedScriptText = normalizeScriptLineBreaks(scriptText);
    const lines = normalizedScriptText.split(/\r?\n/);
    const records = [];
    let row = {};
    let currentSection = '';

    const SECTION_ALIAS = {
      '대사출력': 'dialogue',
      '소리제어': 'audio',
      '그림제어': 'image',
      '연출제어': 'fx',
      '흐름제어': 'flow',
      '변수제어': 'state',
      '선택지': 'choices',
      '히든선택지': 'hiddenChoices'
    };


    const appendChoiceLine = (key, value) => {
      if (!Array.isArray(row[key])) row[key] = [];
      row[key].push(value);
    };

    const flush = () => {
      if (Object.keys(row).length === 0) return;
      if (Array.isArray(row.선택지)) {
        row.choices = parseChoiceSectionLines(row.선택지);
      }
      if (Array.isArray(row.히든선택지)) {
        row.hiddenChoices = parseChoiceSectionLines(row.히든선택지);
      }
      records.push(normalizeDialogueRow(row));
      row = {};
      currentSection = '';
    };

    lines.forEach((rawLine) => {
      const line = cleanText(rawLine);
      if (!line) return;
      if (line === '---') {
        flush();
        return;
      }
      if (line.startsWith('//') || line.startsWith(';')) return;

      if (line.startsWith('@')) {
        flush();
        const target = cleanText(line.slice(1));
        const [scene = '', anchor = ''] = target.split('#').map((part) => cleanAnchorToken(part));
        row.태그 = scene;
        row.앵커 = anchor;
        return;
      }

      const sectionMatch = line.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        const sectionName = cleanText(sectionMatch[1]);
        currentSection = SECTION_ALIAS[sectionName] || '';
        return;
      }

      const listMatch = line.match(/^-\s*(.+)$/);
      if (listMatch && (currentSection === 'choices' || currentSection === 'hiddenChoices')) {
        const listValue = cleanText(listMatch[1]);
        if (!listValue) return;
        if (currentSection === 'choices') appendChoiceLine('선택지', listValue);
        if (currentSection === 'hiddenChoices') appendChoiceLine('히든선택지', listValue);
        return;
      }

      const kvMatch = line.match(/^([^:=]+?)\s*[:=]\s*(.*)$/);
      if (!kvMatch) {
        if (currentSection === 'choices') appendChoiceLine('선택지', line);
        if (currentSection === 'hiddenChoices') appendChoiceLine('히든선택지', line);
        return;
      }

      const explicitKey = cleanText(kvMatch[1]);
      const value = cleanText(kvMatch[2]);
      if (!explicitKey) return;

      const key = explicitKey;

      if (key === '선택지') {
        row.choices = parseChoiceList(value);
        return;
      }
      if (key === '히든선택지') {
        row.hiddenChoices = parseChoiceList(value);
        return;
      }

      row[key] = value;
    });

    flush();
    if (records.length === 0) {
      throw new Error('대사 스크립트에서 유효한 블록을 찾지 못했습니다. @scene#anchor와 [섹션] 구성을 확인해 주세요.');
    }
    return records;
  };

  const parseDialoguesFromCsvText = (scriptText, options = {}) => {
    // 하위 호환 API 이름 유지: 내부 구현은 신규 스크립트 문법을 사용한다.
    const records = parseAllDialoguesFromScriptText(scriptText);
    return selectDialogueSegment(records, options);
  };

  const loadDialoguesFromCsvUrl = async (csvUrl, options = {}) => {
    // 외부 공개 API: 스크립트 URL에서 바로 로딩 + 필터링.
    const response = await fetch(csvUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`대사 스크립트 파일을 불러오지 못했습니다: ${response.status}`);
    }
    const text = await response.text();
    return parseDialoguesFromCsvText(text, options);
  };

  const createDialogueTemplate = ({
    mount,
    dialogues,
    csvUrl,
    sceneTag = '',
    anchorId = '',
    backgroundUrl = '',
    variables = {},
    showMeta = false,
    onDebugStateChange,
    onSkip,
    onError
  } = {}) => {
    // 외부 공개 API: mount 요소 내부에 대화 프로토타입 UI를 생성한다.
    if (!mount) {
      throw new Error('dialogue template mount 요소가 필요합니다.');
    }

    const root = document.createElement('section');
    root.className = 'dialogue-prototype';
    root.setAttribute('aria-live', 'polite');

    root.innerHTML = `
      <div class="dialogue-prototype__bg" aria-hidden="true">
      </div>
      <div class="dialogue-prototype__light" aria-hidden="true"></div>
      <div class="dialogue-prototype__particles" aria-hidden="true"></div>
      <div class="dialogue-prototype__transition" aria-hidden="true"></div>
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
    const lightLayer = root.querySelector('.dialogue-prototype__light');
    const particleLayer = root.querySelector('.dialogue-prototype__particles');
    const transitionLayer = root.querySelector('.dialogue-prototype__transition');
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
    let lastRenderedKey = '';
    let isDialogueEnded = false;
    // 같은 배경 URL을 연속 렌더할 때 불필요한 재로딩을 피하기 위해 상태를 기억한다.
    let currentBackgroundUrl = '';
    const backgroundLoadCache = new Map();
    const debugListeners = new Set();
    const traceEntries = [];
    const audioChannels = {
      bgm: new Audio(),
      bgs: new Audio(),
      voice: new Audio(),
      sfx: new Audio()
    };
    audioChannels.bgm.preload = 'auto';
    audioChannels.bgs.preload = 'auto';
    audioChannels.voice.preload = 'auto';
    audioChannels.sfx.preload = 'auto';
    let autoAdvanceTimer = null;
    const cameraState = { x: 0, y: 0, scale: 1 };
    const uiState = {
      hudVisible: true,
      nameVisible: true,
      choicesLocked: false,
      skipVisible: true
    };

    const snapshotDebugState = () => ({
      filters: { ...currentFilters },
      index,
      queueLength: queue.length,
      isChoiceStep,
      isDialogueEnded,
      variables: { ...sharedVariables },
      trace: [...traceEntries]
    });

    const emitDebugState = () => {
      const snapshot = snapshotDebugState();
      if (typeof onDebugStateChange === 'function') {
        onDebugStateChange(snapshot);
      }
      debugListeners.forEach((listener) => {
        if (typeof listener === 'function') listener(snapshot);
      });
    };

    const pushTrace = (type, payload = {}) => {
      traceEntries.push({
        type,
        payload,
        at: new Date().toISOString()
      });
      // 추적 로그가 무한 증가해 느려지는 것을 막기 위해 최신 120개만 보관한다.
      if (traceEntries.length > 120) {
        traceEntries.splice(0, traceEntries.length - 120);
      }
      emitDebugState();
    };


    const preloadImageForDiagnostics = ({
      url,
      cache,
      traceType,
      tracePayload = {},
      consoleLabel = '이미지'
    } = {}) => {
      const targetUrl = cleanText(url);
      if (!targetUrl) return;
      const cachedStatus = cache.get(targetUrl);
      if (cachedStatus === 'loaded') return;
      if (cachedStatus === 'error') {
        pushTrace(traceType, { url: targetUrl, ...tracePayload });
        return;
      }
      const image = new Image();
      image.onload = () => {
        cache.set(targetUrl, 'loaded');
      };
      image.onerror = () => {
        cache.set(targetUrl, 'error');
        pushTrace(traceType, { url: targetUrl, ...tracePayload });
        console.warn(`[DialogueTemplate] ${consoleLabel} 로딩 실패:`, targetUrl);
      };
      image.src = targetUrl;
    };

    const setBackground = (url) => {
      // 배경 렌더는 항상 즉시 반영하고, 프리로드는 실패 진단(trace) 용도로만 사용한다.
      const rowBackgroundUrl = cleanText(url);
      const fallbackBackgroundUrl = cleanText(backgroundUrl);
      const targetUrl = rowBackgroundUrl || currentBackgroundUrl || fallbackBackgroundUrl;
      if (!bg) return;
      if (!targetUrl) {
        currentBackgroundUrl = '';
        return;
      }
      if (targetUrl !== currentBackgroundUrl) {
        bg.style.backgroundImage = `linear-gradient(to top, rgba(0, 0, 0, 0.58), rgba(0, 0, 0, 0.18)), url("${targetUrl}")`;
        currentBackgroundUrl = targetUrl;
      }
      preloadImageForDiagnostics({
        url: targetUrl,
        cache: backgroundLoadCache,
        traceType: 'background-load-error',
        consoleLabel: '배경 이미지'
      });
    };

    const applyAudioDirective = (channelName, directive, { restartOnSameUrl = false } = {}) => {
      if (!directive) return;
      const audio = audioChannels[channelName];
      if (!audio) return;
      if (directive.action === 'stop') {
        audio.pause();
        audio.currentTime = 0;
        return;
      }
      const url = cleanText(directive.url);
      if (!url) return;
      const shouldReload = audio.src !== new URL(url, window.location.href).href;
      if (shouldReload) {
        audio.src = url;
      } else if (restartOnSameUrl) {
        audio.currentTime = 0;
      }
      if (typeof directive.loop === 'boolean') {
        audio.loop = directive.loop;
      }
      if (Number.isFinite(directive.volume)) {
        audio.volume = Math.max(0, Math.min(1, directive.volume));
      }
      audio.play().catch(() => {
        // 자동재생 제한(브라우저 정책)으로 실패할 수 있으므로 콘솔 경고만 남긴다.
      });
    };

    const clearAutoAdvanceTimer = () => {
      if (autoAdvanceTimer) {
        clearTimeout(autoAdvanceTimer);
        autoAdvanceTimer = null;
      }
    };

    const applyScreenFx = (effectName = '') => {
      const normalized = cleanText(effectName).toLowerCase();
      root.classList.remove('is-fx-flash', 'is-fx-shake', 'is-fx-dim');
      if (!normalized) return;
      if (normalized === 'flash') root.classList.add('is-fx-flash');
      if (normalized === 'shake') root.classList.add('is-fx-shake');
      if (normalized === 'dim') root.classList.add('is-fx-dim');
      // 일회성 연출은 짧게 적용 후 자동 해제한다.
      window.setTimeout(() => {
        root.classList.remove('is-fx-flash', 'is-fx-shake', 'is-fx-dim');
      }, 420);
    };

    const applyCameraFx = (commands = []) => {
      if (!bg || commands.length === 0) return;
      commands.forEach((command) => {
        if (!command) return;
        if (command.action === 'reset') {
          cameraState.x = 0;
          cameraState.y = 0;
          cameraState.scale = 1;
          return;
        }
        if (command.action === 'pan') {
          cameraState.x = command.x;
          cameraState.y = command.y;
        }
        if (command.action === 'zoom') {
          cameraState.scale = command.scale;
        }
      });
      const durationMs = commands.at(-1)?.durationMs ?? 320;
      [bg].forEach((layer) => {
        if (!layer) return;
        layer.style.transition = `transform ${durationMs}ms ease`;
        layer.style.transform = `translate(${cameraState.x}px, ${cameraState.y}px) scale(${cameraState.scale})`;
      });
    };

    const applyUiFx = (uiFx = {}) => {
      const normalized = uiFx || {};
      const toToggle = (value, defaultValue = true) => {
        if (!value) return defaultValue;
        return !['off', 'hide', 'false', '0'].includes(String(value).toLowerCase());
      };
      if (Object.prototype.hasOwnProperty.call(normalized, 'hud')) {
        uiState.hudVisible = toToggle(normalized.hud, uiState.hudVisible);
      }
      if (Object.prototype.hasOwnProperty.call(normalized, 'name')) {
        uiState.nameVisible = toToggle(normalized.name, uiState.nameVisible);
      }
      if (Object.prototype.hasOwnProperty.call(normalized, 'skip')) {
        uiState.skipVisible = toToggle(normalized.skip, uiState.skipVisible);
      }
      if (Object.prototype.hasOwnProperty.call(normalized, 'choices')) {
        uiState.choicesLocked = ['lock', 'locked', 'off', 'false', '0'].includes(String(normalized.choices).toLowerCase());
      }
      if (panelElement) panelElement.hidden = !uiState.hudVisible;
      if (nameElement) nameElement.hidden = !uiState.nameVisible;
      if (skipButton) skipButton.hidden = !uiState.skipVisible;
      if (choicesElement) {
        choicesElement.classList.toggle('is-choice-locked', uiState.choicesLocked);
      }
    };

    const applyHapticFx = (hapticFx) => {
      if (!hapticFx || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
      const map = {
        light: [24],
        medium: [48],
        heavy: [90]
      };
      const pattern = Array.isArray(hapticFx.pattern) ? hapticFx.pattern : (map[hapticFx.pattern] || []);
      if (pattern.length > 0) navigator.vibrate(pattern);
    };

    const applyParticleFx = (particleFx = {}) => {
      if (!particleLayer) return;
      const shouldEnable = particleFx.enabled !== false && particleFx.mode && particleFx.mode !== 'off';
      particleLayer.dataset.mode = shouldEnable ? particleFx.mode : '';
      if (!shouldEnable) {
        particleLayer.replaceChildren();
        return;
      }
      if (particleLayer.childElementCount > 0 && particleLayer.dataset.mode === particleFx.mode) {
        return;
      }
      particleLayer.replaceChildren();
      const count = particleFx.mode === 'ember' ? 16 : 26;
      for (let i = 0; i < count; i += 1) {
        const dot = document.createElement('span');
        dot.className = 'dialogue-prototype__particle';
        dot.style.left = `${Math.random() * 100}%`;
        dot.style.setProperty('--particle-delay', `${Math.round(Math.random() * 1000)}ms`);
        dot.style.setProperty('--particle-duration', `${2400 + Math.round(Math.random() * 2200)}ms`);
        particleLayer.appendChild(dot);
      }
    };

    const applyLightFx = (lightFx) => {
      if (!lightLayer || !lightFx) return;
      if (lightFx.action === 'off') {
        lightLayer.style.background = 'transparent';
        return;
      }
      if (lightFx.action === 'tint') {
        lightLayer.style.transition = `background ${lightFx.durationMs || 320}ms ease`;
        lightLayer.style.background = `${lightFx.color}${Math.round((lightFx.alpha || 0) * 255).toString(16).padStart(2, '0')}`;
      }
    };

    const applyTransitionFx = (transitionFx) => {
      if (!transitionLayer || !transitionFx) return;
      const isBlack = transitionFx.action === 'fade-black';
      transitionLayer.style.background = isBlack ? 'rgba(0,0,0,0.92)' : 'rgba(255,255,255,0.9)';
      transitionLayer.style.transition = 'none';
      transitionLayer.style.opacity = '0';
      void transitionLayer.offsetWidth;
      transitionLayer.style.transition = `opacity ${transitionFx.durationMs}ms ease`;
      transitionLayer.style.opacity = '1';
      window.setTimeout(() => {
        transitionLayer.style.opacity = '0';
      }, transitionFx.durationMs);
    };

    const applySelection = (filters = {}) => {
      // 현재 전체 레코드에서 scene/anchor 조건으로 표시 큐를 재구성한다.
      // 분기 선택지 클릭, 외부 jumpTo, 초기 진입 모두 이 함수를 사용한다.
      currentFilters = {
        sceneTag: filters.sceneTag ?? currentFilters.sceneTag,
        anchorId: filters.anchorId ?? currentFilters.anchorId
      };
      const baseVariables = { ...sharedVariables };
      queue = buildRunnableQueue(allRecords, currentFilters, baseVariables);
      index = 0;
      isDialogueEnded = false;
      lastRenderedKey = '';
      if (queue.length === 0) {
        throw new Error('조건을 통과한 대사가 없어 진행할 수 없습니다.');
      }

      pushTrace('apply-selection', {
        sceneTag: currentFilters.sceneTag || '',
        anchorId: currentFilters.anchorId || '',
        queueLength: queue.length
      });
      render();
    };

    const refreshQueueByCurrentFilters = ({ preserveCursor = true } = {}) => {
      // 변수 재평가 시 현재 scene/anchor 필터를 유지한 채 조건식을 다시 계산한다.
      // preserveCursor=true면 가능한 경우 현재 줄 위치를 유지한다.
      const currentRow = preserveCursor ? queue[index] : null;
      const baseVariables = { ...sharedVariables };
      const nextQueue = buildRunnableQueue(allRecords, currentFilters, baseVariables);
      if (nextQueue.length === 0) {
        throw new Error('조건을 통과한 대사가 없어 진행할 수 없습니다.');
      }
      queue = nextQueue;
      if (currentRow) {
        const nextIndex = nextQueue.indexOf(currentRow);
        if (nextIndex >= 0) {
          index = nextIndex;
          render();
          return;
        }
      }
      index = 0;
      lastRenderedKey = '';
      pushTrace('refresh-queue', {
        queueLength: queue.length,
        preserveCursor
      });
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
        card.dataset.choiceEffects = JSON.stringify(choice.effects || []);
        card.style.setProperty('--choice-delay', `${choiceIndex * 48}ms`);
      });

      if (!cardTemplateApi?.createCardFanBehavior || !cardTemplateApi?.createDiscardZoneController || renderedCards.length === 0) {
        cards.forEach((button) => {
          button.addEventListener('click', () => {
            const choiceEffects = JSON.parse(button.dataset.choiceEffects || '[]');
            sharedVariables = applyEffects(sharedVariables, choiceEffects);
            pushTrace('choice-selected', {
              sceneTag: button.dataset.choiceScene || currentFilters.sceneTag || '',
              anchorId: button.dataset.choiceAnchor || '',
              effects: choiceEffects
            });
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
          const choiceEffects = JSON.parse(card.dataset.choiceEffects || '[]');
          sharedVariables = applyEffects(sharedVariables, choiceEffects);
          pushTrace('choice-selected', {
            sceneTag: card.dataset.choiceScene || currentFilters.sceneTag || '',
            anchorId: card.dataset.choiceAnchor || '',
            effects: choiceEffects
          });
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
      const currentRenderKey = `${current.scene}::${current.anchor}::${index}`;
      if (currentRenderKey !== lastRenderedKey) {
        // `변수` 컬럼은 현재 줄 렌더 시점에 공용 상태로 합쳐 다음 줄에서도 재사용되게 유지한다.
        // 예: start 줄에서 `playerName=순례자`를 주입하면 이후 줄의 `{{playerName}}`도 정상 치환.
        sharedVariables = { ...sharedVariables, ...(current.variables || {}) };
        sharedVariables = applyEffects(sharedVariables, current.effects || []);
        applyAudioDirective('bgm', current.bgm);
        applyAudioDirective('bgs', current.bgs);
        applyAudioDirective('voice', current.voice, { restartOnSameUrl: true });
        applyAudioDirective('sfx', current.sfx, { restartOnSameUrl: true });
        applyScreenFx(current.screenFx);
        applyCameraFx(current.cameraFx);
        applyUiFx(current.uiFx);
        applyHapticFx(current.hapticFx);
        applyParticleFx(current.particleFx);
        applyLightFx(current.lightFx);
        applyTransitionFx(current.transitionFx);
        lastRenderedKey = currentRenderKey;
      }
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
        .filter((choice) => evaluateConditionExpression(choice.condition, templateVariables))
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
      isDialogueEnded = Boolean(current.endDialogue);
      renderChoices(choices, {
        restoreChoices: choices,
        hiddenChoices,
        isHiddenMode: false
      });
      playDialogueMotion();
      emitDebugState();
      if (nextButton) {
        nextButton.style.opacity = isChoiceStep ? '0.58' : '1';
      }

      // 자동 넘김은 선택지/종료 구간에서는 비활성화한다.
      clearAutoAdvanceTimer();
      if (!isChoiceStep && !isDialogueEnded && Number(current.autoNextMs) > 0) {
        autoAdvanceTimer = window.setTimeout(() => {
          goNext();
        }, Number(current.autoNextMs));
      }
    };

    const setAllRecords = (records, filters = {}) => {
      // 외부 데이터 교체 시 전체 레코드를 저장하고, 현재 필터로 즉시 재선택/렌더한다.
      allRecords = records.map(normalizeDialogueRow);
      if (allRecords.length === 0) {
        allRecords = [...DEFAULT_DIALOGUES];
      }
      applySelection({
        sceneTag: filters.sceneTag ?? sceneTag,
        anchorId: filters.anchorId ?? anchorId
      });
    };

    const reportError = (error) => {
      // 사용자 노출용 로딩 배지는 제거하고, 에러는 콜백/콘솔 중심으로 전달한다.
      pushTrace('error', {
        message: error?.message || 'unknown error'
      });
      if (typeof onError === 'function') {
        onError(error);
      }
    };

    const goNext = () => {
      // 선택지가 열려 있는 구간에서는 임의 진행을 막고,
      // 버튼 선택으로만 분기하도록 보호한다.
      if (queue.length === 0 || isChoiceStep || isDialogueEnded) return;
      const current = queue[index];
      const jump = current?.jump;
      if (jump?.scene || jump?.anchor) {
        const nextFilters = {
          sceneTag: jump.scene || currentFilters.sceneTag,
          anchorId: jump.anchor || ''
        };
        pushTrace('jump', {
          sceneTag: nextFilters.sceneTag || '',
          anchorId: nextFilters.anchorId || ''
        });
        try {
          applySelection(nextFilters);
        } catch (error) {
          // 점프 타겟 오타/누락 시 무반응처럼 보이지 않도록
          // 디버그 콜백으로 명시적 에러를 전달한다.
          reportError(error);
        }
        return;
      }
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
            throw new Error(`대사 스크립트 파일을 불러오지 못했습니다: ${response.status}`);
          }
          return response.text();
        })
        .then((text) => {
          const records = parseAllDialoguesFromScriptText(text);
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
        // 런타임에서 URL 기반 스크립트를 다시 불러올 때 사용.
        try {
          const response = await fetch(nextCsvUrl, { cache: 'no-store' });
          if (!response.ok) {
            throw new Error(`대사 스크립트 파일을 불러오지 못했습니다: ${response.status}`);
          }
          const text = await response.text();
          const records = parseAllDialoguesFromScriptText(text);
          setAllRecords(records, filters);
        } catch (error) {
          reportError(error);
        }
      },
      async loadFromCsvFile(file, filters = {}) {
        // 런타임에서 로컬 스크립트 파일(File API)을 직접 업로드할 때 사용.
        try {
          const text = await file.text();
          const records = parseAllDialoguesFromScriptText(text);
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
        pushTrace('set-variables', { changed: { ...nextVariables } });
        // 변수 변경으로 조건 분기가 달라질 수 있으므로 현재 큐를 재평가한다.
        // 단, 가능한 경우 현재 줄을 유지해 "임의 첫 줄 점프" 체감을 줄인다.
        refreshQueueByCurrentFilters({ preserveCursor: true });
      },
      getDebugState() {
        // 외부(테스트 UI)에서 현재 변수/큐/최근 이벤트를 조회할 수 있도록 제공한다.
        return snapshotDebugState();
      },
      subscribeDebug(listener) {
        if (typeof listener !== 'function') {
          return () => {};
        }
        debugListeners.add(listener);
        listener(snapshotDebugState());
        return () => {
          debugListeners.delete(listener);
        };
      },
      clearDebugTrace() {
        traceEntries.length = 0;
        emitDebugState();
      },
      destroy() {
        clearAutoAdvanceTimer();
        debugListeners.clear();
        Object.values(audioChannels).forEach((audio) => {
          audio.pause();
          audio.src = '';
        });
        root.remove();
      }
    };
  };

  // 신규 네임스페이스: 템플릿 명칭에 맞춰 공개한다.
  global.NewtheriaDialogueTemplate = {
    createDialogueTemplate,
    loadDialoguesFromCsvUrl,
    parseDialoguesFromCsvText,
    selectDialogueSegment
  };
  // 하위 호환: 기존 호출부(window.NewtheriaDialoguePrototype)도 유지한다.
  global.NewtheriaDialoguePrototype = {
    createDialoguePrototype: createDialogueTemplate,
    loadDialoguesFromCsvUrl,
    parseDialoguesFromCsvText,
    selectDialogueSegment
  };
})(window);
