(function attachDialogueTemplate(global) {
  // ---------------------------------------------------------------------------
  // ASDF v-next parser/runtime
  // 헤더 문법: <event:이름> / <scene#n:이름> / <block:anchor>
  // 블록 내부 문법: { ... } 내부에서 key = value, choice = 라벨 -> anchor
  // ---------------------------------------------------------------------------

  const cleanText = (value, fallback = '') => {
    if (value == null) return fallback;
    return String(value).trim();
  };

  const parseValueLiteral = (rawValue = '') => {
    const value = cleanText(rawValue);
    if (!value) return { ok: true, value: '' };

    // 따옴표 문자열: "..." 형태를 허용한다.
    if (value.startsWith('"')) {
      if (!value.endsWith('"') || value.length === 1) {
        return { ok: false, error: '닫히지 않은 문자열(")입니다.' };
      }
      const inner = value.slice(1, -1)
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n');
      return { ok: true, value: inner };
    }

    return { ok: true, value };
  };

  const parseBoolean = (value) => ['1', 'true', 'yes', 'on', '예', 'end'].includes(cleanText(value).toLowerCase());
  const parseIntegerOrDefault = (value, fallback = 0) => {
    const parsed = Number.parseInt(cleanText(value), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  // {player_name} 같은 템플릿 토큰을 현재 변수 스냅샷으로 치환한다.
  const resolveTemplateVariables = (text = '', variables = {}) => String(text).replace(/\{([a-zA-Z0-9_.-]+)\}/g, (full, key) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      const value = variables[key];
      return value == null ? '' : String(value);
    }
    return full;
  });
  const STORAGE_KEYS = {
    characterCatalog: 'newtheria.characters',
    dialogueProgress: 'newtheria.dialogue.progress',
    saveSlotsMeta: 'newtheria.saveSlots.meta',
    saveSlotsData: 'newtheria.saveSlots.data'
  };
  // 샘플/로컬 테스트용 임시 캐릭터 카탈로그.
  // 실제 프로젝트에서는 createDialogueTemplate({ characterCatalog })로 주입해 교체한다.
  const DEFAULT_CHARACTER_CATALOG = {
    goddess: {
      id: 'goddess',
      name: '아스테리아',
      layers: ['assets/img/goddess.png']
    },
    pilgrim: {
      id: 'pilgrim',
      name: '순례자',
      layers: ['assets/img/player.png']
    }
  };
  const normalizeFocus = (value) => {
    const v = cleanText(value).toLowerCase();
    if (['left', 'l', '좌', 'left-slot'].includes(v)) return 'left';
    if (['right', 'r', '우', 'right-slot'].includes(v)) return 'right';
    if (['none', 'off', '없음', 'clear', '-'].includes(v)) return 'none';
    return '';
  };

  const parseBlockKeyValue = (line) => {
    const match = line.match(/^([^=]+?)\s*=\s*(.*)$/);
    if (!match) return null;
    const parsedValue = parseValueLiteral(match[2]);
    if (!parsedValue.ok) {
      return { key: cleanText(match[1]).toLowerCase(), value: '', error: parsedValue.error };
    }
    return { key: cleanText(match[1]).toLowerCase(), value: parsedValue.value };
  };

  const parseChoiceValue = (value) => {
    const match = cleanText(value).match(/^(.+?)\s*->\s*([\w\-가-힣_]+)$/);
    if (!match) return null;
    const labelValue = parseValueLiteral(match[1]);
    if (!labelValue.ok) return null;
    return {
      label: cleanText(labelValue.value),
      targetAnchor: cleanText(match[2])
    };
  };

  const parseHeader = (line) => {
    const eventMatch = line.match(/^<event\s*:\s*([^>]+)>$/i);
    if (eventMatch) {
      const eventId = cleanText(eventMatch[1]);
      return eventId ? { type: 'event', eventId } : null;
    }

    const sceneMatch = line.match(/^<scene#(\d+)\s*:\s*([^>]+)>$/i);
    if (sceneMatch) {
      const sceneIndex = Number(sceneMatch[1]);
      const sceneName = cleanText(sceneMatch[2]);
      return Number.isInteger(sceneIndex) && sceneIndex >= 0
        ? { type: 'scene', sceneIndex, sceneName }
        : null;
    }

    const blockMatch = line.match(/^<block(?:\s*:\s*([^>]+))?>$/i);
    if (blockMatch) {
      return { type: 'block', anchor: cleanText(blockMatch[1] || '') };
    }

    return null;
  };

  const parseAsdfScript = (sourceText = '', options = {}) => {
    const lines = String(sourceText).split(/\r?\n/);
    const errors = [];
    let persistedCharacterCatalog = {};
    let saveSlotCharacterCatalog = {};
    try {
      const raw = global?.localStorage?.getItem?.(STORAGE_KEYS.characterCatalog);
      persistedCharacterCatalog = raw ? JSON.parse(raw) : {};
    } catch (error) {
      persistedCharacterCatalog = {};
    }
    try {
      const metaRaw = global?.localStorage?.getItem?.(STORAGE_KEYS.saveSlotsMeta);
      const dataRaw = global?.localStorage?.getItem?.(STORAGE_KEYS.saveSlotsData);
      const meta = metaRaw ? JSON.parse(metaRaw) : {};
      const data = dataRaw ? JSON.parse(dataRaw) : {};
      const activeSlotId = cleanText(meta?.activeSlotId || data?.activeSlotId || 'slot1');
      saveSlotCharacterCatalog = data?.slots?.[activeSlotId]?.characters || {};
    } catch (error) {
      saveSlotCharacterCatalog = {};
    }
    const characterCatalog = new Map(
      Object.entries({
        ...DEFAULT_CHARACTER_CATALOG,
        ...saveSlotCharacterCatalog,
        ...persistedCharacterCatalog,
        ...(options?.characterCatalog || {})
      }).map(([id, profile]) => [id, profile])
    );
    const castBundles = new Map(Object.entries(options?.castBundles || {}));

    let currentEventId = '';
    let currentSceneIndex = null;
    let currentSceneName = '';
    let currentBlock = null;
    let currentSceneCast = null;

    const events = new Map();
    const sceneMap = new Map();
    const anchorMap = new Map();

    const ensureEvent = (eventId) => {
      if (!events.has(eventId)) {
        events.set(eventId, { id: eventId, scenes: [] });
      }
      return events.get(eventId);
    };

    const makeSceneKey = (eventId, sceneIndex) => `${eventId}::${sceneIndex}`;

    const ensureScene = (eventId, sceneIndex, sceneName) => {
      const key = makeSceneKey(eventId, sceneIndex);
      if (!sceneMap.has(key)) {
        const scene = {
          eventId,
          sceneIndex,
          sceneName,
          cast: {
            actors: new Map(),
            slotLeft: '',
            slotRight: '',
            focus: ''
          },
          blocks: []
        };
        sceneMap.set(key, scene);
        ensureEvent(eventId).scenes.push(scene);
      }
      return sceneMap.get(key);
    };

    // 여러 별칭 키 중 "실제로 입력된 값"을 구분해서 꺼낸다.
    // - key가 아예 없으면 null 반환 (블록에서 해당 명령 미지정)
    // - key가 있으면 문자열 정리 후 반환 (빈 문자열 포함)
    const readOptionalBlockValue = (block, keys = []) => {
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(block, key)) {
          return cleanText(block[key]);
        }
      }
      return null;
    };

    const flushBlock = () => {
      if (!currentBlock) return;
      const scene = ensureScene(currentEventId, currentSceneIndex, currentSceneName);
      const blockOrder = scene.blocks.length;
      const normalized = {
        eventId: currentEventId,
        sceneIndex: currentSceneIndex,
        sceneName: currentSceneName,
        anchor: cleanText(currentBlock.anchor),
        order: blockOrder,
        speaker: cleanText(currentBlock.speaker),
        speakerId: cleanText(currentBlock.speaker_id || currentBlock.speakerid || currentBlock.actor || currentBlock.actor_id),
        line: cleanText(currentBlock.line),
        background: cleanText(currentBlock.bg || currentBlock.background),
        jump: cleanText(currentBlock.jump),
        end: parseBoolean(currentBlock.end),
        // 스킵 잠금 문법:
        // - skip_lock = on|off (권장)
        // - skip = lock|unlock, skip_disabled = true|false (별칭)
        // 별도 해제 지시가 없으면 scene 전환 전까지 상태를 유지한다.
        skipLockDirective: readOptionalBlockValue(currentBlock, [
          'skip_lock',
          'skiplock',
          'skip_disabled',
          'skipdisabled',
          'skip',
          '스킵잠금',
          '스킵불가'
        ]),
        sfx: cleanText(currentBlock.sfx),
        // standing_left/right가 "미지정"인지 "명시적으로 비움"인지 구분해야
        // 블록마다 기본 배치를 의도치 않게 초기화하지 않는다.
        standingLeft: readOptionalBlockValue(currentBlock, ['standing_left', 'standingleft', '스탠딩좌', 'move_left']),
        standingRight: readOptionalBlockValue(currentBlock, ['standing_right', 'standingright', '스탠딩우', 'move_right']),
        standingFocus: cleanText(currentBlock.standing_focus || currentBlock.standingfocus || currentBlock.스탠딩포커스 || currentBlock.focus),
        standingAnimation: cleanText(currentBlock.standing_animation || currentBlock.standinganimation || currentBlock.스탠딩애니메이션),
        standingAnimationLeft: cleanText(
          currentBlock.standing_animation_left
          || currentBlock.standinganimation_left
          || currentBlock.standing_animation_l
          || currentBlock.standinganimationl
          || currentBlock.스탠딩애니메이션좌
        ),
        standingAnimationRight: cleanText(
          currentBlock.standing_animation_right
          || currentBlock.standinganimation_right
          || currentBlock.standing_animation_r
          || currentBlock.standinganimationr
          || currentBlock.스탠딩애니메이션우
        ),
        standingAnimationActor: cleanText(
          currentBlock.standing_animation_actor
          || currentBlock.standinganimation_actor
          || currentBlock.standing_animation_by_actor
          || currentBlock.standinganimationbyactor
          || currentBlock.스탠딩애니메이션액터
        ),
        standingHide: cleanText(currentBlock.hide),
        standingSetLayers: cleanText(currentBlock.set_layers),
        // 대기/타자기 연출 문법:
        // - wait = 800          (밀리초 후 자동 진행)
        // - type_speed = 24     (문자당 24ms 타자기 속도)
        waitMs: parseIntegerOrDefault(currentBlock.wait || currentBlock.delay || currentBlock.pause || currentBlock.auto_next_ms, 0),
        typeSpeed: parseIntegerOrDefault(currentBlock.type_speed || currentBlock.typewriter_speed || currentBlock.type_ms, 0),
        particleMode: cleanText(currentBlock.particle || currentBlock.particles || currentBlock.fx_particle || currentBlock.vfx_particle).toLowerCase(),
        particleCount: parseIntegerOrDefault(currentBlock.particle_count || currentBlock.particles_count, 18),
        particleDuration: parseIntegerOrDefault(currentBlock.particle_duration || currentBlock.particles_duration, 3200),
        choices: Array.isArray(currentBlock.choices) ? [...currentBlock.choices] : [],
        hiddenChoices: Array.isArray(currentBlock.hiddenChoices) ? [...currentBlock.hiddenChoices] : []
      };

      if (normalized.anchor) {
        if (anchorMap.has(normalized.anchor)) {
          errors.push(`anchor 중복: ${normalized.anchor}`);
        } else {
          anchorMap.set(normalized.anchor, {
            eventId: normalized.eventId,
            sceneIndex: normalized.sceneIndex,
            order: normalized.order
          });
        }
      }

      scene.blocks.push(normalized);
      currentBlock = null;
    };

    const flushSceneCast = () => {
      if (!currentSceneCast) return;
      const scene = ensureScene(currentEventId, currentSceneIndex, currentSceneName);
      scene.cast = currentSceneCast;
      currentSceneCast = null;
    };

    lines.forEach((rawLine, lineNo) => {
      const line = cleanText(rawLine);
      if (!line || line.startsWith(';') || line.startsWith('//') || line.startsWith('#')) return;

      if (line === '---') {
        flushSceneCast();
        flushBlock();
        return;
      }

      const header = parseHeader(line);
      if (header) {
        flushSceneCast();
        flushBlock();

        if (header.type === 'event') {
          currentEventId = header.eventId;
          currentSceneIndex = null;
          currentSceneName = '';
          ensureEvent(currentEventId);
          return;
        }

        if (header.type === 'scene') {
          if (!currentEventId) {
            errors.push(`line ${lineNo + 1}: scene 헤더 전에 event 헤더가 필요합니다.`);
            return;
          }
          currentSceneIndex = header.sceneIndex;
          currentSceneName = header.sceneName;
          const sceneKey = makeSceneKey(currentEventId, currentSceneIndex);
          if (sceneMap.has(sceneKey)) {
            errors.push(`scene 중복: ${currentEventId}#${currentSceneIndex}`);
            return;
          }
          ensureScene(currentEventId, currentSceneIndex, currentSceneName);
          // scene 헤더 직후 `{ ... }`로 씬 기본 캐스팅을 작성할 수 있다.
          currentSceneCast = {
            openBraceSeen: false,
            closeBraceSeen: false,
            actors: new Map(),
            slotLeft: '',
            slotRight: '',
            focus: '',
            castRef: '',
            castJson: ''
          };
          return;
        }

        if (header.type === 'block') {
          if (!currentEventId || currentSceneIndex == null) {
            errors.push(`line ${lineNo + 1}: block 헤더 전에 event/scene 헤더가 필요합니다.`);
            return;
          }
          currentBlock = {
            anchor: header.anchor,
            openBraceSeen: false,
            closeBraceSeen: false,
            choices: [],
            hiddenChoices: []
          };
          return;
        }
      }

      if (!currentBlock && !currentSceneCast) {
        errors.push(`line ${lineNo + 1}: block 내부가 아닌 위치의 키/값입니다.`);
        return;
      }

      const currentKvContainer = currentSceneCast || currentBlock;

      if (!currentKvContainer.openBraceSeen) {
        if (line !== '{') {
          errors.push(`line ${lineNo + 1}: 헤더 시작 후 첫 줄은 '{' 이어야 합니다.`);
          return;
        }
        currentKvContainer.openBraceSeen = true;
        return;
      }

      if (line === '}') {
        currentKvContainer.closeBraceSeen = true;
        return;
      }

      if (currentKvContainer.closeBraceSeen) {
        errors.push(`line ${lineNo + 1}: '}' 이후에는 내용이 올 수 없습니다. block 종료는 --- 입니다.`);
        return;
      }

      const kv = parseBlockKeyValue(line);
      if (!kv) {
        errors.push(`line ${lineNo + 1}: 블록 내부는 key = value 형식만 허용합니다.`);
        return;
      }
      if (kv.error) {
        errors.push(`line ${lineNo + 1}: ${kv.error}`);
        return;
      }

      if (currentSceneCast) {
        if (kv.key === 'actor') {
          // actor = actorId (캐릭터 카탈로그에서 조회)
          const [idRaw] = kv.value.split('|').map((token) => cleanText(token));
          if (!idRaw) {
            errors.push(`line ${lineNo + 1}: actor 문법 오류 (예: actor = astra)`);
            return;
          }
          currentSceneCast.actors.set(idRaw, { id: idRaw, name: idRaw, layers: [] });
          return;
        }
        if (kv.key === 'slot_left') {
          currentSceneCast.slotLeft = kv.value;
          return;
        }
        if (kv.key === 'slot_right') {
          currentSceneCast.slotRight = kv.value;
          return;
        }
        if (kv.key === 'focus') {
          currentSceneCast.focus = kv.value;
          return;
        }
        if (kv.key === 'cast_ref') {
          // 미래 확장: 외부 캐릭터 번들을 참조할 수 있도록 식별자 필드를 미리 확보한다.
          currentSceneCast.castRef = kv.value;
          return;
        }
        if (kv.key === 'cast_json') {
          // 미래 확장: 캐릭터 번들(JSON 직렬화)을 바로 주입할 수 있도록 예약한다.
          currentSceneCast.castJson = kv.value;
          return;
        }
        errors.push(`line ${lineNo + 1}: scene 캐스팅 지원 키는 actor/slot_left/slot_right/focus/cast_ref/cast_json 입니다.`);
        return;
      }

      if (kv.key === 'choice') {
        const choice = parseChoiceValue(kv.value);
        if (!choice) {
          errors.push(`line ${lineNo + 1}: choice 문법 오류 (예: choice = 라벨 -> anchor)`);
          return;
        }
        currentBlock.choices.push(choice);
        return;
      }

      if (kv.key === 'hidden_choice') {
        const hiddenChoice = parseChoiceValue(kv.value);
        if (!hiddenChoice) {
          errors.push(`line ${lineNo + 1}: hidden_choice 문법 오류 (예: hidden_choice = 라벨 -> anchor)`);
          return;
        }
        currentBlock.hiddenChoices.push(hiddenChoice);
        return;
      }

      currentBlock[kv.key] = kv.value;
    });

    flushSceneCast();
    flushBlock();

    const eventList = [...events.values()].map((event) => {
      event.scenes.sort((a, b) => a.sceneIndex - b.sceneIndex);
      return event;
    });

    // scene cast actor id를 실제 캐릭터 데이터(이름/레이어)로 해석한다.
    eventList.forEach((event) => {
      event.scenes.forEach((scene) => {
        const cast = scene.cast || {};
        const actors = new Map(cast.actors || []);
        const bundledActors = new Map();
        if (cleanText(cast.castRef) && castBundles.has(cleanText(cast.castRef))) {
          const bundle = castBundles.get(cleanText(cast.castRef));
          const list = Array.isArray(bundle?.actors) ? bundle.actors : [];
          list.forEach((item) => {
            const id = cleanText(item?.id);
            if (!id) return;
            bundledActors.set(id, {
              id,
              name: cleanText(item?.name, id),
              layers: Array.isArray(item?.layers) ? item.layers.map((layer) => cleanText(layer)).filter(Boolean) : []
            });
          });
        }
        if (cleanText(cast.castJson)) {
          try {
            const bundle = JSON.parse(cast.castJson);
            const list = Array.isArray(bundle?.actors) ? bundle.actors : [];
            list.forEach((item) => {
              const id = cleanText(item?.id);
              if (!id) return;
              bundledActors.set(id, {
                id,
                name: cleanText(item?.name, id),
                layers: Array.isArray(item?.layers) ? item.layers.map((layer) => cleanText(layer)).filter(Boolean) : []
              });
            });
          } catch (error) {
            errors.push(`scene(${event.id}#${scene.sceneIndex}) cast_json 파싱 실패: ${error?.message || 'invalid json'}`);
          }
        }

        actors.forEach((actor, actorId) => {
          const byBundle = bundledActors.get(actorId);
          const byCatalog = characterCatalog.get(actorId);
          const resolved = byBundle || byCatalog;
          if (!resolved) {
            errors.push(`scene(${event.id}#${scene.sceneIndex}) actor 미등록: ${actorId}`);
            return;
          }
          actors.set(actorId, {
            id: actorId,
            name: cleanText(resolved.name, actorId),
            layers: Array.isArray(resolved.layers) ? resolved.layers.map((layer) => cleanText(layer)).filter(Boolean) : []
          });
        });
        scene.cast.actors = actors;
      });
    });

    if (eventList.length === 0) errors.push('event가 없습니다. <event:...> 헤더가 필요합니다.');
    eventList.forEach((event) => {
      if (event.scenes.length === 0) errors.push(`event(${event.id})에 scene이 없습니다.`);
      event.scenes.forEach((scene) => {
        if (scene.blocks.length === 0) {
          errors.push(`scene(${event.id}#${scene.sceneIndex})에 block이 없습니다.`);
        }
      });
    });

    // block braces 및 jump/choice 타겟 검증
    eventList.forEach((event) => {
      event.scenes.forEach((scene) => {
        scene.blocks.forEach((block) => {
          if (block.jump && !anchorMap.has(block.jump)) {
            errors.push(`jump 타겟 미존재: ${block.jump}`);
          }
          block.choices.forEach((choice) => {
            if (!anchorMap.has(choice.targetAnchor)) {
              errors.push(`choice 타겟 미존재: ${choice.targetAnchor}`);
            }
          });
          block.hiddenChoices.forEach((choice) => {
            if (!anchorMap.has(choice.targetAnchor)) {
              errors.push(`hidden_choice 타겟 미존재: ${choice.targetAnchor}`);
            }
          });
        });
      });
    });

    if (errors.length > 0) {
      throw new Error(`ASDF 검증 실패\n- ${errors.join('\n- ')}`);
    }

    return {
      events: eventList,
      eventMap: new Map(eventList.map((event) => [event.id, event])),
      anchorMap
    };
  };

  const selectEntry = (model, { eventId = '', sceneId = '', anchor = '', nodeId = '' } = {}) => {
    const targetAnchor = cleanText(anchor);
    if (targetAnchor && model.anchorMap.has(targetAnchor)) {
      const hit = model.anchorMap.get(targetAnchor);
      return { ...hit };
    }

    const targetEventId = cleanText(eventId);
    const targetSceneRaw = cleanText(sceneId || nodeId);
    const targetSceneIndex = targetSceneRaw === '' ? null : Number(targetSceneRaw);

    if (targetEventId && model.eventMap.has(targetEventId)) {
      const event = model.eventMap.get(targetEventId);
      if (Number.isInteger(targetSceneIndex) && targetSceneIndex >= 0) {
        const scene = event.scenes.find((item) => item.sceneIndex === targetSceneIndex);
        if (scene) return { eventId: targetEventId, sceneIndex: targetSceneIndex, order: 0 };
      }
      return { eventId: targetEventId, sceneIndex: event.scenes[0]?.sceneIndex || 0, order: 0 };
    }

    const firstEvent = model.events[0];
    return {
      eventId: firstEvent?.id || '',
      sceneIndex: firstEvent?.scenes[0]?.sceneIndex || 0,
      order: 0
    };
  };

  const getBlockByPointer = (model, pointer) => {
    const event = model.eventMap.get(pointer.eventId);
    if (!event) return null;
    const scene = event.scenes.find((item) => item.sceneIndex === pointer.sceneIndex);
    if (!scene) return null;
    return {
      event,
      scene,
      block: scene.blocks[pointer.order] || null
    };
  };

  const parseDialoguesFromCsvText = (sourceText = '', options = {}) => parseAsdfScript(sourceText, options);

  const loadDialoguesFromCsvUrl = async (url = '', options = {}) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`대사 파일을 불러오지 못했습니다: ${response.status}`);
    }
    const text = await response.text();
    return parseAsdfScript(text, options);
  };

  const selectDialogueSegment = (model, options = {}) => {
    if (!model?.events) return [];
    const ptr = selectEntry(model, options);
    const hit = getBlockByPointer(model, ptr);
    return hit?.block ? [hit.block] : [];
  };

  const createDialogueTemplate = ({
    mount,
    csvUrl,
    dialogues,
    eventId = '',
    sceneId = '',
    anchor = '',
    nodeId = '',
    backgroundUrl = '',
    characterCatalog = {},
    castBundles = {},
    dialogueSessionKey = STORAGE_KEYS.dialogueProgress,
    showMeta = true,
    onError,
    onSkip,
    onDebugStateChange
  } = {}) => {
    if (!mount) throw new Error('dialogue template mount 요소가 필요합니다.');

    const root = document.createElement('section');
    root.className = 'dialogue-prototype';
    root.innerHTML = `
      <div class="dialogue-prototype__bg" aria-hidden="true"></div>
      <div class="dialogue-prototype__particles" data-mode="off" aria-hidden="true"></div>
      <div class="dialogue-prototype__actors" data-has-actors="false" data-focus="none" aria-hidden="true">
        <div class="dialogue-prototype__actor dialogue-prototype__actor--left"></div>
        <div class="dialogue-prototype__actor dialogue-prototype__actor--right"></div>
      </div>
      <div class="dialogue-prototype__choices" id="dialogueChoices" aria-label="선택지"></div>
      <div class="dialogue-prototype__drag-overlay" aria-hidden="true"></div>
      <div class="dialogue-prototype__discard-zone" id="dialogueDiscardZone" aria-hidden="true">
        <span class="discard-icon">🗑</span>
        <span>카드를 버리려면 여기로 드래그</span>
      </div>
      <section class="dialogue-prototype__panel" aria-label="대화창">
        <p class="dialogue-prototype__meta"></p>
        <p class="dialogue-prototype__name"></p>
        <p class="dialogue-prototype__line"></p>
        <button class="dialogue-prototype__next" type="button" aria-label="다음 대사">▼</button>
      </section>
      <button class="dialogue-prototype__ui-toggle" type="button" aria-pressed="false">UI 숨김</button>
      <button class="dialogue-prototype__skip" type="button">SKIP</button>
    `;
    mount.replaceChildren(root);

    const el = {
      bg: root.querySelector('.dialogue-prototype__bg'),
      particles: root.querySelector('.dialogue-prototype__particles'),
      actors: root.querySelector('.dialogue-prototype__actors'),
      actorLeft: root.querySelector('.dialogue-prototype__actor--left'),
      actorRight: root.querySelector('.dialogue-prototype__actor--right'),
      choices: root.querySelector('#dialogueChoices'),
      discardZone: root.querySelector('#dialogueDiscardZone'),
      meta: root.querySelector('.dialogue-prototype__meta'),
      name: root.querySelector('.dialogue-prototype__name'),
      line: root.querySelector('.dialogue-prototype__line'),
      next: root.querySelector('.dialogue-prototype__next'),
      uiToggle: root.querySelector('.dialogue-prototype__ui-toggle'),
      skip: root.querySelector('.dialogue-prototype__skip')
    };

    // 카드형 선택지 인스턴스(팬 배치/드래그/디스카드)를 보관해
    // 선택지 재렌더 시 리스너 누수 없이 안전하게 교체한다.
    let activeChoiceCardBehavior = null;
    let activeDiscardZoneController = null;

    let model = { events: [], eventMap: new Map(), anchorMap: new Map() };
    let pointer = { eventId: '', sceneIndex: 0, order: 0 };
    let standingState = {
      left: '',
      right: '',
      focus: '',
      actors: new Map(),
      hidden: new Set()
    };
    let trace = [];
    const debugListeners = new Set();
    let runtimeVariables = {};
    let activeLineTimer = null;
    let activeAutoNextTimer = null;
    let isLineAnimating = false;
    let skipLocked = false;
    let skipLockSceneKey = '';
    let isUiHidden = false;

    const parseSkipLockDirective = (value) => {
      const token = cleanText(value).toLowerCase();
      if (!token) return null;
      if (['on', 'true', '1', 'lock', 'locked', 'disable', 'disabled', '불가', '잠금'].includes(token)) return true;
      if (['off', 'false', '0', 'unlock', 'enabled', 'enable', '가능', '해제'].includes(token)) return false;
      return null;
    };

    const applySkipButtonState = () => {
      if (!el.skip) return;
      el.skip.disabled = skipLocked;
      el.skip.setAttribute('aria-disabled', skipLocked ? 'true' : 'false');
      el.skip.textContent = skipLocked ? 'SKIP LOCKED' : 'SKIP';
    };

    const applyUiHiddenState = () => {
      root.classList.toggle('is-ui-hidden', isUiHidden);
      if (el.uiToggle) {
        el.uiToggle.setAttribute('aria-pressed', isUiHidden ? 'true' : 'false');
        el.uiToggle.textContent = isUiHidden ? 'UI 표시' : 'UI 숨김';
      }
    };

    const emitDebug = () => {
      const leftActor = standingState.actors.get(standingState.left);
      const rightActor = standingState.actors.get(standingState.right);
      const leftLayers = standingState.hidden.has(standingState.left) ? [] : (leftActor?.layers || []);
      const rightLayers = standingState.hidden.has(standingState.right) ? [] : (rightActor?.layers || []);
      const payload = {
        currentEventId: pointer.eventId,
        currentSceneIndex: pointer.sceneIndex,
        currentOrder: pointer.order,
        standing: {
          leftSlotActorId: cleanText(standingState.left),
          rightSlotActorId: cleanText(standingState.right),
          focusActorId: cleanText(standingState.focus),
          hiddenActorIds: Array.from(standingState.hidden),
          actors: Array.from(standingState.actors.entries()).map(([id, actor]) => ({
            id,
            name: cleanText(actor?.name, id),
            layers: Array.isArray(actor?.layers) ? actor.layers.filter(Boolean) : []
          })),
          rendered: {
            left: {
              actorId: cleanText(standingState.left),
              layerCount: leftLayers.length,
              visible: leftLayers.length > 0
            },
            right: {
              actorId: cleanText(standingState.right),
              layerCount: rightLayers.length,
              visible: rightLayers.length > 0
            }
          }
        },
        trace: trace.slice(-30)
      };
      if (typeof onDebugStateChange === 'function') onDebugStateChange(payload);
      debugListeners.forEach((listener) => listener(payload));
    };

    const log = (type, data = {}) => {
      trace.push({ at: new Date().toISOString(), type, data });
      emitDebug();
    };

    const reportError = (error) => {
      log('error', { message: error?.message || 'unknown' });
      if (typeof onError === 'function') onError(error);
    };

    // 배경 유지 정책:
    // - 같은 scene 안에서는 block에 배경이 "명시적으로" 주어졌을 때만 변경한다.
    // - scene이 바뀌면, 새 scene 첫 block에 배경이 없을 경우 기본 backgroundUrl로 초기화한다.
    // 이렇게 하면 block마다 배경이 기본값으로 덮이는 현상을 막고, scene 경계에서는 의도된 초기화가 가능하다.
    let lastRenderedSceneKey = '';
    const setBackground = ({ value = '', sceneKey = '' } = {}) => {
      const explicitUrl = cleanText(value);
      const fallbackUrl = cleanText(backgroundUrl);
      const isSceneChanged = Boolean(sceneKey) && sceneKey !== lastRenderedSceneKey;
      let nextUrl = '';

      if (explicitUrl) {
        // block에 배경이 있으면 항상 그 값을 우선 적용한다.
        nextUrl = explicitUrl;
      } else if (isSceneChanged && fallbackUrl) {
        // scene 전환 시에는 기본 배경으로만 초기화한다.
        nextUrl = fallbackUrl;
      }

      if (nextUrl && el.bg) {
        el.bg.style.backgroundImage = `url("${nextUrl.replace(/"/g, '\\"')}")`;
      }
      if (sceneKey) lastRenderedSceneKey = sceneKey;
    };

    const goToPointer = (nextPointer) => {
      if (activeLineTimer) {
        clearInterval(activeLineTimer);
        activeLineTimer = null;
      }
      if (activeAutoNextTimer) {
        clearTimeout(activeAutoNextTimer);
        activeAutoNextTimer = null;
      }
      isLineAnimating = false;
      pointer = { ...nextPointer };
      renderCurrent();
    };

    const saveSessionProgress = (anchor = '') => {
      try {
        sessionStorage.setItem(dialogueSessionKey, JSON.stringify({
          ...pointer,
          anchor: cleanText(anchor)
        }));
      } catch (error) {
        // 세션 저장 실패(시크릿 모드/저장 불가)는 진행 자체를 막지 않는다.
      }
    };

    const setStandingImage = (slotEl, url = '') => {
      if (!slotEl) return;
      if (!url) {
        slotEl.removeAttribute('style');
        slotEl.dataset.visible = 'false';
        return;
      }
      slotEl.style.backgroundImage = `url("${url.replace(/"/g, '\\"')}")`;
      slotEl.dataset.visible = 'true';
    };

    const applyParticlesFromBlock = (block) => {
      if (!el.particles) return;
      const mode = cleanText(block.particleMode).toLowerCase();
      if (!mode || ['off', 'none', 'clear', '-'].includes(mode)) {
        el.particles.dataset.mode = 'off';
        el.particles.replaceChildren();
        return;
      }
      el.particles.dataset.mode = mode;
      el.particles.replaceChildren();

      const particleCount = Math.min(64, Math.max(4, parseIntegerOrDefault(block.particleCount, 18)));
      const particleDuration = Math.min(12000, Math.max(600, parseIntegerOrDefault(block.particleDuration, 3200)));
      for (let i = 0; i < particleCount; i += 1) {
        const particle = document.createElement('span');
        particle.className = 'dialogue-prototype__particle';
        particle.style.left = `${Math.round(Math.random() * 100)}%`;
        particle.style.setProperty('--particle-delay', `${Math.round(Math.random() * 1200)}ms`);
        particle.style.setProperty('--particle-duration', `${Math.round(particleDuration * (0.72 + Math.random() * 0.56))}ms`);
        particle.style.opacity = String(0.4 + Math.random() * 0.5);
        particle.style.transform = `translateY(${Math.round(Math.random() * 14)}px) scale(${(0.75 + Math.random() * 0.75).toFixed(2)})`;
        el.particles.appendChild(particle);
      }
    };

    const setActorLayers = (slotEl, layers = []) => {
      if (!slotEl) return;
      slotEl.replaceChildren();
      const safeLayers = Array.isArray(layers) ? layers.filter(Boolean) : [];
      if (safeLayers.length === 0) {
        setStandingImage(slotEl, '');
        return;
      }
      // 단일 일러도, 다중 레이어 일러도 동일한 슬롯 구조로 처리한다.
      safeLayers.forEach((layerUrl, index) => {
        const layer = document.createElement('div');
        layer.className = 'dialogue-prototype__actor-layer';
        layer.style.zIndex = String(index + 1);
        layer.style.backgroundImage = `url("${String(layerUrl).replace(/"/g, '\\"')}")`;
        slotEl.appendChild(layer);
      });
      slotEl.dataset.visible = 'true';
    };

    const resolveActorLabel = (scene, block) => {
      const explicitName = cleanText(resolveTemplateVariables(block.speaker, runtimeVariables));
      if (explicitName) return explicitName;
      const actorId = cleanText(block.speakerId);
      if (!actorId) return '???';
      const actor = scene.cast?.actors?.get?.(actorId) || standingState.actors.get(actorId);
      return cleanText(resolveTemplateVariables(actor?.name, runtimeVariables), actorId);
    };

    const initializeStandingStateForScene = (scene) => {
      const cast = scene.cast || {};
      let actors = new Map(cast.actors || []);
      if (cleanText(cast.castJson)) {
        try {
          const bundle = JSON.parse(cast.castJson);
          const bundledActors = Array.isArray(bundle?.actors) ? bundle.actors : [];
          bundledActors.forEach((item) => {
            const id = cleanText(item?.id);
            if (!id) return;
            const layers = Array.isArray(item?.layers)
              ? item.layers.map((layer) => cleanText(layer)).filter(Boolean)
              : [];
            actors.set(id, { id, name: cleanText(item?.name, id), layers });
          });
        } catch (error) {
          log('cast-json-parse-failed', { message: error?.message || 'invalid cast_json' });
        }
      }
      standingState = {
        left: cleanText(cast.slotLeft),
        right: cleanText(cast.slotRight),
        focus: cleanText(cast.focus),
        actors,
        hidden: new Set()
      };
    };

    // 블록은 "씬 기본 캐스팅"을 기준으로 포커싱/이동/숨김만 가볍게 제어한다.
    const applyStandingFromBlock = (block) => {
      const normalizeActorToken = (token = '') => {
        const text = cleanText(token);
        if (!text) return '';
        if (['none', 'off', '-', 'clear', '없음'].includes(text.toLowerCase())) return '';
        return text;
      };
      // null은 "키 미지정"을 의미하므로 기존 scene 기본 배치를 유지한다.
      // 문자열(빈 문자열 포함)인 경우에만 명령으로 간주해 슬롯을 갱신한다.
      const hasLeftDirective = block.standingLeft !== null && block.standingLeft !== undefined;
      const hasRightDirective = block.standingRight !== null && block.standingRight !== undefined;
      const leftActorId = hasLeftDirective ? normalizeActorToken(block.standingLeft) : '';
      const rightActorId = hasRightDirective ? normalizeActorToken(block.standingRight) : '';
      if (hasLeftDirective) standingState.left = leftActorId;
      if (hasRightDirective) standingState.right = rightActorId;

      const hideTokens = cleanText(block.standingHide)
        .split(',')
        .map((token) => cleanText(token))
        .filter(Boolean);
      hideTokens.forEach((token) => {
        if (token === 'all') {
          standingState.hidden = new Set([standingState.left, standingState.right].filter(Boolean));
          return;
        }
        if (token === 'left' && standingState.left) standingState.hidden.add(standingState.left);
        else if (token === 'right' && standingState.right) standingState.hidden.add(standingState.right);
        else standingState.hidden.add(token);
      });

      const focusActorId = normalizeActorToken(block.standingFocus);
      if (focusActorId) standingState.focus = focusActorId;

      if (cleanText(block.standingSetLayers)) {
        // set_layers = actorId:imgA,imgB
        const [actorIdRaw, layerRaw = ''] = block.standingSetLayers.split(':');
        const actorId = cleanText(actorIdRaw);
        const layers = layerRaw.split(',').map((item) => cleanText(item)).filter(Boolean);
        if (actorId) {
          const prev = standingState.actors.get(actorId) || { id: actorId, name: actorId, layers: [] };
          standingState.actors.set(actorId, { ...prev, layers });
        }
      }

      const leftActor = standingState.actors.get(standingState.left);
      const rightActor = standingState.actors.get(standingState.right);
      const leftLayers = standingState.hidden.has(standingState.left) ? [] : (leftActor?.layers || []);
      const rightLayers = standingState.hidden.has(standingState.right) ? [] : (rightActor?.layers || []);

      const hasActors = leftLayers.length > 0 || rightLayers.length > 0;
      if (el.actors) {
        el.actors.dataset.hasActors = hasActors ? 'true' : 'false';
        const focusSlot = standingState.focus && standingState.focus === standingState.left ? 'left'
          : standingState.focus && standingState.focus === standingState.right ? 'right'
            : 'none';
        el.actors.dataset.focus = focusSlot;
      }
      const clearSlotAnimation = (slotEl) => {
        if (!slotEl) return;
        slotEl.removeAttribute('data-animation');
      };
      const setSlotAnimation = (slotEl, animationName = '') => {
        if (!slotEl) return;
        const normalized = cleanText(animationName).toLowerCase();
        if (normalized) slotEl.dataset.animation = normalized;
        else slotEl.removeAttribute('data-animation');
      };
      const parseScopedAnimations = (rawAnimation = '') => {
        const scoped = {
          left: '',
          right: '',
          byActor: {}
        };
        cleanText(rawAnimation)
          .split(',')
          .map((token) => cleanText(token))
          .filter(Boolean)
          .forEach((token) => {
            const kv = token.match(/^([^:=]+)\s*[:=]\s*([a-z0-9_-]+)$/i);
            if (!kv) return;
            const scope = cleanText(kv[1]).toLowerCase();
            const animationName = cleanText(kv[2]).toLowerCase();
            if (!animationName) return;
            if (['left', 'l', '좌', 'left-slot'].includes(scope)) scoped.left = animationName;
            else if (['right', 'r', '우', 'right-slot'].includes(scope)) scoped.right = animationName;
            else if (['all', 'both', '*', '전체'].includes(scope)) {
              scoped.left = animationName;
              scoped.right = animationName;
            } else {
              // left/right/all 예약어가 아니면 "actorId 지정"으로 간주한다.
              // 예) standing_animation = goddess:float,pilgrim:shake
              scoped.byActor[cleanText(kv[1])] = animationName;
            }
          });
        return scoped;
      };
      const parseActorAnimationList = (rawActorAnimation = '') => {
        const actorMap = {};
        cleanText(rawActorAnimation)
          .split(',')
          .map((token) => cleanText(token))
          .filter(Boolean)
          .forEach((token) => {
            const kv = token.match(/^([^:=]+)\s*[:=]\s*([a-z0-9_-]+)$/i);
            if (!kv) return;
            const actorId = cleanText(kv[1]);
            const animationName = cleanText(kv[2]).toLowerCase();
            if (!actorId || !animationName) return;
            actorMap[actorId] = animationName;
          });
        return actorMap;
      };
      const globalAnimation = cleanText(block.standingAnimation).toLowerCase();
      const scopedAnimations = parseScopedAnimations(block.standingAnimation);
      const explicitActorAnimationMap = parseActorAnimationList(block.standingAnimationActor);
      const currentLeftSlotActorId = cleanText(standingState.left);
      const currentRightSlotActorId = cleanText(standingState.right);
      const leftActorAnimation = currentLeftSlotActorId
        ? (explicitActorAnimationMap[currentLeftSlotActorId] || scopedAnimations.byActor[currentLeftSlotActorId] || '')
        : '';
      const rightActorAnimation = currentRightSlotActorId
        ? (explicitActorAnimationMap[currentRightSlotActorId] || scopedAnimations.byActor[currentRightSlotActorId] || '')
        : '';
      const leftAnimation = cleanText(
        leftActorAnimation
        || block.standingAnimationLeft
        || scopedAnimations.left
        || globalAnimation
      ).toLowerCase();
      const rightAnimation = cleanText(
        rightActorAnimation
        || block.standingAnimationRight
        || scopedAnimations.right
        || globalAnimation
      ).toLowerCase();
      // 블록 단위로 애니메이션 상태를 초기화해 이전 블록 연출이 누적되지 않게 한다.
      clearSlotAnimation(el.actorLeft);
      clearSlotAnimation(el.actorRight);
      // actorId 기준 매핑 → 슬롯 키 → 전체 공통 순서로 우선순위를 부여한다.
      setSlotAnimation(el.actorLeft, leftAnimation);
      setSlotAnimation(el.actorRight, rightAnimation);

      setActorLayers(el.actorLeft, leftLayers);
      setActorLayers(el.actorRight, rightLayers);
    };

    const renderChoices = (choices = [], context = {}) => {
      const {
        restoreChoices = choices,
        hiddenChoices = [],
        isHiddenMode = false
      } = context;
      if (!el.choices) return;
      el.choices.innerHTML = '';
      activeChoiceCardBehavior?.destroy?.();
      activeChoiceCardBehavior = null;
      activeDiscardZoneController?.reset?.();
      activeDiscardZoneController = null;
      if (!Array.isArray(choices) || choices.length === 0) return;

      // 공용 카드 템플릿(NewtheriaCardTemplates)을 우선 사용해
      // 시작 화면과 동일한 카드형 선택지 인터랙션(팬/호버/드래그/롱프레스)을 유지한다.
      if (global.NewtheriaCardTemplates?.renderCardFanCards && global.NewtheriaCardTemplates?.createCardFanBehavior) {
        const cards = global.NewtheriaCardTemplates.renderCardFanCards(el.choices, choices.map((choice) => ({
            route: choice.targetAnchor,
            icon: '✦',
            label: choice.label,
            desc: '운명의 갈림길',
            brand: 'NEWTHERIA',
            sigil: '✦'
          })));
        cards.forEach((card, cardIndex) => {
          card.classList.add('dialogue-prototype__choice');
          card.style.setProperty('--choice-delay', `${cardIndex * 30}ms`);
        });

        activeDiscardZoneController = global.NewtheriaCardTemplates.createDiscardZoneController({
          zone: el.discardZone,
          documentBody: root,
          activeClassName: 'is-drag-discard-active',
          visibleClassName: 'is-drag-discard-visible',
          revealDistancePx: 96
        });

        activeChoiceCardBehavior = global.NewtheriaCardTemplates.createCardFanBehavior({
          menu: el.choices,
          cards
        });
        activeChoiceCardBehavior.layoutCards();
        activeChoiceCardBehavior.bindInteractions({
          onDragStateChange: (isDragging) => {
            activeDiscardZoneController?.onDragStateChange?.(isDragging);
          },
          onDragMove: ({ event, moved }) => {
            activeDiscardZoneController?.onDragMove?.({ event, moved });
          },
          shouldDiscardDrop: ({ event }) => activeDiscardZoneController?.shouldDiscardDrop?.({ event }) || false,
          onCardDiscarded: (_, remainingCards) => {
            // 일반 선택지를 모두 버리면 hidden_choice를 노출한다.
            if (remainingCards.length === 0) {
              if (!isHiddenMode && Array.isArray(hiddenChoices) && hiddenChoices.length > 0) {
                log('hidden-choice-reveal', { hiddenChoiceCount: hiddenChoices.length });
                renderChoices(hiddenChoices, {
                  restoreChoices,
                  hiddenChoices,
                  isHiddenMode: true
                });
                return;
              }
              // hidden_choice까지 모두 버린 경우 기본 선택지로 복원해 진행 막힘을 방지한다.
              renderChoices(restoreChoices, {
                restoreChoices,
                hiddenChoices,
                isHiddenMode: false
              });
            }
          },
          onCardSelected: (card) => {
            const targetAnchor = cleanText(card?.dataset?.route);
            const selectedChoice = choices.find((choice) => cleanText(choice.targetAnchor) === targetAnchor);
            if (!selectedChoice) {
              reportError(new Error(`선택지 데이터를 찾지 못했습니다: ${targetAnchor}`));
              return;
            }
            const target = model.anchorMap.get(selectedChoice.targetAnchor);
            if (!target) {
              reportError(new Error(`choice 타겟 anchor를 찾지 못했습니다: ${selectedChoice.targetAnchor}`));
              return;
            }
            log('choice', { label: selectedChoice.label, targetAnchor: selectedChoice.targetAnchor, isHiddenMode });
            goToPointer(target);
          }
        });
        return;
      }

      // 카드 템플릿이 없는 환경에서도 선택 기능 자체는 유지한다.
      choices.forEach((choice, idx) => {
        const button = document.createElement('button');
        button.className = 'dialogue-prototype__choice';
        button.type = 'button';
        button.textContent = `${idx + 1}. ${choice.label}`;
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          const target = model.anchorMap.get(choice.targetAnchor);
          if (!target) {
            reportError(new Error(`choice 타겟 anchor를 찾지 못했습니다: ${choice.targetAnchor}`));
            return;
          }
          log('choice', { label: choice.label, targetAnchor: choice.targetAnchor, isHiddenMode });
          goToPointer(target);
        });
        el.choices.appendChild(button);
      });
    };

    const renderCurrent = () => {
      const hit = getBlockByPointer(model, pointer);
      if (!hit?.block) {
        reportError(new Error('현재 포인터에 해당하는 block이 없습니다.'));
        return;
      }

      const { scene, block } = hit;
      const sceneKey = `${pointer.eventId}::${scene.sceneIndex}`;
      if (sceneKey !== skipLockSceneKey) {
        // 요구사항: 스킵 잠금은 별도 on/off가 없으면 "scene 전환 전까지만" 유지한다.
        skipLocked = false;
        skipLockSceneKey = sceneKey;
      }
      const skipDirective = parseSkipLockDirective(block.skipLockDirective);
      if (skipDirective !== null) skipLocked = skipDirective;
      applySkipButtonState();
      if (showMeta && el.meta) {
        const anchorLabel = block.anchor ? `:${block.anchor}` : '';
        el.meta.textContent = `${pointer.eventId} / scene#${scene.sceneIndex}(${scene.sceneName}) / block#${pointer.order}${anchorLabel}`;
      }
      if (pointer.order === 0) {
        initializeStandingStateForScene(scene);
      }
      if (el.name) el.name.textContent = resolveActorLabel(scene, block);
      const resolvedLine = resolveTemplateVariables(block.line || '', runtimeVariables);
      if (activeLineTimer) {
        clearInterval(activeLineTimer);
        activeLineTimer = null;
      }
      if (activeAutoNextTimer) {
        clearTimeout(activeAutoNextTimer);
        activeAutoNextTimer = null;
      }
      if (el.line) {
        const typeSpeed = Math.max(0, parseIntegerOrDefault(block.typeSpeed, 0));
        if (typeSpeed > 0 && resolvedLine.length > 0) {
          isLineAnimating = true;
          let cursor = 0;
          el.line.textContent = '';
          activeLineTimer = global.setInterval(() => {
            cursor += 1;
            el.line.textContent = resolvedLine.slice(0, cursor);
            if (cursor >= resolvedLine.length) {
              clearInterval(activeLineTimer);
              activeLineTimer = null;
              isLineAnimating = false;
            }
          }, typeSpeed);
        } else {
          isLineAnimating = false;
          el.line.textContent = resolvedLine;
        }
      }
      setBackground({
        value: block.background,
        sceneKey: `${pointer.eventId}::${scene.sceneIndex}`
      });
      applyStandingFromBlock(block);
      applyParticlesFromBlock(block);
      renderChoices(block.choices, {
        restoreChoices: block.choices,
        hiddenChoices: block.hiddenChoices,
        isHiddenMode: false
      });
      saveSessionProgress(block.anchor);
      const hasChoices = (Array.isArray(block.choices) && block.choices.length > 0)
        || (Array.isArray(block.hiddenChoices) && block.hiddenChoices.length > 0);
      const waitMs = Math.max(0, parseIntegerOrDefault(block.waitMs, 0));
      if (!hasChoices && waitMs > 0) {
        activeAutoNextTimer = global.setTimeout(() => {
          activeAutoNextTimer = null;
          goNext();
        }, waitMs);
      }
      log('render-block', {
        eventId: pointer.eventId,
        sceneIndex: scene.sceneIndex,
        order: pointer.order,
        anchor: block.anchor,
        choiceCount: block.choices.length,
        waitMs,
        skipLocked,
        typeSpeed: parseIntegerOrDefault(block.typeSpeed, 0),
        particleMode: cleanText(block.particleMode)
      });
    };

    const findSkipDestination = () => {
      // SKIP은 "선택지", "씬 전환 직후", "종료 지점"을 만날 때까지 내부적으로 빠르게 전개한다.
      // 렌더는 최종 목적지 1회만 수행해 체감 속도를 확보한다.
      const startPtr = { ...pointer };
      const startHit = getBlockByPointer(model, startPtr);
      if (!startHit?.block) return null;

      const visited = new Set();
      let cursor = { ...startPtr };
      let stepCount = 0;

      while (stepCount < 1000) {
        stepCount += 1;
        const key = `${cursor.eventId}|${cursor.sceneIndex}|${cursor.order}`;
        if (visited.has(key)) return cursor;
        visited.add(key);

        const hit = getBlockByPointer(model, cursor);
        if (!hit?.block) return cursor;
        const { event, scene, block } = hit;
        const hasChoices = (Array.isArray(block.choices) && block.choices.length > 0)
          || (Array.isArray(block.hiddenChoices) && block.hiddenChoices.length > 0);
        if (hasChoices || block.end) return cursor;

        let nextPtr = null;
        if (block.jump) {
          nextPtr = model.anchorMap.get(block.jump) || null;
          if (!nextPtr) return cursor;
        } else if (scene.blocks[cursor.order + 1]) {
          nextPtr = { eventId: cursor.eventId, sceneIndex: cursor.sceneIndex, order: cursor.order + 1 };
        } else {
          const idx = event.scenes.findIndex((item) => item.sceneIndex === scene.sceneIndex);
          if (idx >= 0 && event.scenes[idx + 1]) {
            nextPtr = { eventId: cursor.eventId, sceneIndex: event.scenes[idx + 1].sceneIndex, order: 0 };
          }
        }

        if (!nextPtr) return cursor;
        if (nextPtr.sceneIndex !== cursor.sceneIndex || nextPtr.eventId !== cursor.eventId) return nextPtr;
        cursor = nextPtr;
      }

      return cursor;
    };

    const goNext = () => {
      const hit = getBlockByPointer(model, pointer);
      if (!hit?.block) return;
      const { event, scene, block } = hit;
      if (isLineAnimating && el.line) {
        // 타자기 출력 중 다음 입력이 들어오면 우선 현재 줄 전체를 즉시 완성한다.
        if (activeLineTimer) {
          clearInterval(activeLineTimer);
          activeLineTimer = null;
        }
        el.line.textContent = resolveTemplateVariables(block.line || '', runtimeVariables);
        isLineAnimating = false;
        return;
      }

      if (block.end) {
        log('end', { reason: 'block-end-true' });
        return;
      }

      // 일반 선택지/히든 선택지 중 하나라도 있으면 사용자가 카드를 선택해야 진행된다.
      const hasNormalChoices = Array.isArray(block.choices) && block.choices.length > 0;
      const hasHiddenChoices = Array.isArray(block.hiddenChoices) && block.hiddenChoices.length > 0;
      if (hasNormalChoices || hasHiddenChoices) {
        log('await-choice', {
          anchor: block.anchor,
          choiceCount: block.choices.length,
          hiddenChoiceCount: block.hiddenChoices.length
        });
        return;
      }

      if (block.jump) {
        const target = model.anchorMap.get(block.jump);
        if (!target) {
          reportError(new Error(`jump 대상 anchor를 찾지 못했습니다: ${block.jump}`));
          return;
        }
        goToPointer(target);
        return;
      }

      if (scene.blocks[pointer.order + 1]) {
        goToPointer({ eventId: pointer.eventId, sceneIndex: pointer.sceneIndex, order: pointer.order + 1 });
        return;
      }

      const idx = event.scenes.findIndex((item) => item.sceneIndex === scene.sceneIndex);
      if (idx >= 0 && event.scenes[idx + 1]) {
        goToPointer({ eventId: pointer.eventId, sceneIndex: event.scenes[idx + 1].sceneIndex, order: 0 });
        return;
      }

      log('end', { reason: 'event-tail' });
    };

    const applyModel = (nextModel, filters = {}) => {
      model = nextModel;
      trace = [];
      let sessionPointer = null;
      if (!cleanText(filters.eventId) && !cleanText(filters.sceneId || filters.nodeId) && !cleanText(filters.anchor)) {
        try {
          const raw = sessionStorage.getItem(dialogueSessionKey);
          sessionPointer = raw ? JSON.parse(raw) : null;
        } catch (error) {
          sessionPointer = null;
        }
      }
      pointer = selectEntry(model, {
        eventId: filters.eventId || cleanText(sessionPointer?.eventId),
        sceneId: filters.sceneId || filters.nodeId || cleanText(sessionPointer?.sceneIndex),
        anchor: filters.anchor || cleanText(sessionPointer?.anchor)
      });
      renderCurrent();
    };

    root.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.dialogue-prototype__skip') || target.closest('.dialogue-prototype__choice')) return;
      goNext();
    });

    el.next?.addEventListener('click', (event) => {
      event.stopPropagation();
      goNext();
    });

    el.skip?.addEventListener('click', (event) => {
      event.stopPropagation();
      if (skipLocked) {
        log('skip-blocked', { reason: 'skip-lock' });
        return;
      }
      const destination = findSkipDestination();
      if (!destination) return;
      log('skip-fast-forward', {
        from: { ...pointer },
        to: destination
      });
      goToPointer(destination);
    });

    el.uiToggle?.addEventListener('click', (event) => {
      event.stopPropagation();
      isUiHidden = !isUiHidden;
      applyUiHiddenState();
    });

    const initialFilters = { eventId, sceneId: sceneId || nodeId, anchor };

    if (dialogues?.events) {
      applyModel(dialogues, initialFilters);
    } else if (csvUrl) {
      loadDialoguesFromCsvUrl(csvUrl, { characterCatalog, castBundles })
        .then((loaded) => applyModel(loaded, initialFilters))
        .catch(reportError);
    }
    applyUiHiddenState();
    applySkipButtonState();

    return {
      root,
      setDialogues(nextDialogues, filters = {}) {
        if (!nextDialogues?.events) {
          reportError(new Error('setDialogues에는 parse된 model 객체가 필요합니다.'));
          return;
        }
        applyModel(nextDialogues, filters);
      },
      async loadFromCsvUrl(url, filters = {}) {
        try {
          const loaded = await loadDialoguesFromCsvUrl(url, { characterCatalog, castBundles });
          applyModel(loaded, filters);
        } catch (error) {
          reportError(error);
        }
      },
      async loadFromCsvFile(file, filters = {}) {
        try {
          const loaded = parseAsdfScript(await file.text(), { characterCatalog, castBundles });
          applyModel(loaded, filters);
        } catch (error) {
          reportError(error);
        }
      },
      jumpTo({ eventId: nextEventId = '', sceneId: nextSceneId = '', anchor: nextAnchor = '', nodeId: nextNodeId = '' } = {}) {
        const nextPtr = selectEntry(model, {
          eventId: nextEventId,
          sceneId: nextSceneId || nextNodeId,
          anchor: nextAnchor
        });
        goToPointer(nextPtr);
      },
      setVariables() {
        const patch = arguments[0];
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
          log('set-variables-skipped', { reason: 'patch-object-required' });
          return;
        }
        runtimeVariables = {
          ...runtimeVariables,
          ...patch
        };
        log('set-variables', { keys: Object.keys(patch) });
        renderCurrent();
      },
      getDebugState() {
        const leftActor = standingState.actors.get(standingState.left);
        const rightActor = standingState.actors.get(standingState.right);
        const leftLayers = standingState.hidden.has(standingState.left) ? [] : (leftActor?.layers || []);
        const rightLayers = standingState.hidden.has(standingState.right) ? [] : (rightActor?.layers || []);
        return {
          currentEventId: pointer.eventId,
          currentSceneIndex: pointer.sceneIndex,
          currentOrder: pointer.order,
          standing: {
            leftSlotActorId: cleanText(standingState.left),
            rightSlotActorId: cleanText(standingState.right),
            focusActorId: cleanText(standingState.focus),
            hiddenActorIds: Array.from(standingState.hidden),
            actors: Array.from(standingState.actors.entries()).map(([id, actor]) => ({
              id,
              name: cleanText(actor?.name, id),
              layers: Array.isArray(actor?.layers) ? actor.layers.filter(Boolean) : []
            })),
            rendered: {
              left: {
                actorId: cleanText(standingState.left),
                layerCount: leftLayers.length,
                visible: leftLayers.length > 0
              },
              right: {
                actorId: cleanText(standingState.right),
                layerCount: rightLayers.length,
                visible: rightLayers.length > 0
              }
            }
          },
          trace: trace.slice(-30)
        };
      },
      subscribeDebug(listener) {
        if (typeof listener !== 'function') return () => {};
        debugListeners.add(listener);
        listener(this.getDebugState());
        return () => debugListeners.delete(listener);
      },
      clearDebugTrace() {
        trace = [];
        emitDebug();
      },
      destroy() {
        debugListeners.clear();
        root.remove();
      }
    };
  };

  global.NewtheriaDialogueTemplate = {
    createDialogueTemplate,
    loadDialoguesFromCsvUrl,
    parseDialoguesFromCsvText,
    selectDialogueSegment
  };

  global.NewtheriaDialoguePrototype = {
    createDialoguePrototype: createDialogueTemplate,
    loadDialoguesFromCsvUrl,
    parseDialoguesFromCsvText,
    selectDialogueSegment
  };
})(window);
