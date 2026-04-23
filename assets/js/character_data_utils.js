(function attachCharacterDataUtils(global) {
  const cleanId = (value) => {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const toIdMap = (items = [], idKey = 'id') => {
    const map = new Map();
    items.forEach((item) => {
      const id = cleanId(item?.[idKey]);
      if (id == null) return;
      map.set(id, item);
    });
    return map;
  };

  // 데이터 무결성 검증기
  // 1) id 중복 검증
  // 2) 부모/자식 id 참조 존재성 검증
  // 3) 부모-자식 상호 참조 일관성 검증
  // 4) 숙원/특성 id 참조 존재성 검증
  const validateCharacterData = ({ characters = {}, pools = {} } = {}) => {
    const errors = [];
    const entries = Object.entries(characters || {});

    const characterById = new Map();
    entries.forEach(([key, profile]) => {
      const id = cleanId(profile?.id);
      if (id == null) {
        errors.push(`character(${key}) id가 유효한 정수가 아닙니다.`);
        return;
      }
      if (characterById.has(id)) {
        errors.push(`character id 중복: ${id} (keys: ${characterById.get(id)?.__key}, ${key})`);
        return;
      }
      characterById.set(id, { ...profile, __key: key });
    });

    const traitMap = toIdMap(pools?.innateTraitCatalog || []);
    const aspirationMap = toIdMap(pools?.aspirationDefinitions || []);
    const aspirationPoolMap = toIdMap(pools?.aspirationPoolCatalog || []);

    characterById.forEach((character) => {
      const key = character.__key;
      const links = character.familyLinks || {};
      const fatherId = cleanId(links.fatherId);
      const motherId = cleanId(links.motherId);
      const childrenIds = Array.isArray(links.childrenIds) ? links.childrenIds : [];

      // 부모 참조 검증
      [
        ['fatherId', fatherId],
        ['motherId', motherId]
      ].forEach(([field, id]) => {
        if (id == null) return;
        if (!characterById.has(id)) {
          errors.push(`character(${key}) ${field}=${id} 참조 대상을 찾을 수 없습니다.`);
        }
      });

      // 자식 참조 및 상호 참조 검증
      childrenIds.forEach((childRaw) => {
        const childId = cleanId(childRaw);
        if (childId == null || !characterById.has(childId)) {
          errors.push(`character(${key}) childrenIds에 유효하지 않은 id가 있습니다: ${childRaw}`);
          return;
        }
        const child = characterById.get(childId);
        const childLinks = child.familyLinks || {};
        const childFather = cleanId(childLinks.fatherId);
        const childMother = cleanId(childLinks.motherId);
        if (childFather !== character.id && childMother !== character.id) {
          errors.push(`parent-child 불일치: parent(${character.id}) -> child(${childId}) 상호 참조 누락`);
        }
      });

      // 특성 id 참조 검증
      const innateTraitIds = Array.isArray(character?.traits?.innateTraitIds)
        ? character.traits.innateTraitIds
        : [];
      innateTraitIds.forEach((traitRaw) => {
        const traitId = cleanId(traitRaw);
        if (traitId == null || !traitMap.has(traitId)) {
          errors.push(`character(${key}) innateTraitIds에 정의되지 않은 id가 있습니다: ${traitRaw}`);
        }
      });

      // 숙원 참조 검증 (통합 객체: aspiration.currentId / aspiration.poolId)
      const aspirationState = character.aspiration || {};
      const poolRefId = cleanId(aspirationState.poolId);
      if (poolRefId != null && !aspirationPoolMap.has(poolRefId)) {
        errors.push(`character(${key}) aspiration.poolId=${poolRefId} 참조 대상을 찾을 수 없습니다.`);
      }
      const aspirationId = cleanId(aspirationState.currentId);
      if (aspirationId != null && !aspirationMap.has(aspirationId)) {
        errors.push(`character(${key}) aspiration.currentId=${aspirationId} 참조 대상을 찾을 수 없습니다.`);
      }

      // 인벤토리/소지금/위치 기본 검증
      const wallet = character.wallet || {};
      ['gold', 'silver', 'copper'].forEach((currencyKey) => {
        const amount = Number(wallet[currencyKey] ?? 0);
        if (!Number.isFinite(amount) || amount < 0) {
          errors.push(`character(${key}) wallet.${currencyKey} 값이 유효하지 않습니다.`);
        }
      });

      const location = character.location || {};
      const tile = location.tile || {};
      ['x', 'y', 'z'].forEach((axis) => {
        const coordinate = Number(tile[axis]);
        if (!Number.isFinite(coordinate)) {
          errors.push(`character(${key}) location.tile.${axis} 좌표가 유효하지 않습니다.`);
        }
      });

      const items = Array.isArray(character?.inventory?.items) ? character.inventory.items : [];
      items.forEach((item, index) => {
        if (!item?.itemId) {
          errors.push(`character(${key}) inventory.items[${index}] itemId가 비어 있습니다.`);
        }
        const qty = Number(item?.qty);
        if (!Number.isFinite(qty) || qty <= 0) {
          errors.push(`character(${key}) inventory.items[${index}] qty가 유효하지 않습니다.`);
        }
      });
    });

    return {
      ok: errors.length === 0,
      errors
    };
  };

  // 조회 인덱스 빌더
  // - 런타임에서 문자열 탐색을 줄이고 id 기반 O(1) 조회를 돕는다.
  const buildCharacterIndexes = ({ characters = {}, pools = {} } = {}) => {
    const characterById = new Map();
    Object.values(characters || {}).forEach((profile) => {
      const id = cleanId(profile?.id);
      if (id == null) return;
      characterById.set(id, profile);
    });

    const traitById = toIdMap(pools?.innateTraitCatalog || []);
    const aspirationById = toIdMap(pools?.aspirationDefinitions || []);

    const aspirationPoolById = new Map();
    (pools?.aspirationPoolCatalog || []).forEach((pool) => {
      const poolId = cleanId(pool?.id);
      if (poolId == null) return;
      aspirationPoolById.set(poolId, {
        ...pool,
        aspirations: (pool?.aspirationIds || [])
          .map((id) => aspirationById.get(cleanId(id)))
          .filter(Boolean)
      });
    });

    return {
      characterById,
      traitById,
      aspirationById,
      aspirationPoolById
    };
  };


  // 행동 점수 계산기
  // - 숙원 behaviorProfile을 기반으로 행동 후보 점수를 계산한다.
  // - 디버그 UI에서 "왜 이 행동을 골랐는지" 설명 로그를 만들 때 사용한다.
  const scoreActionByAspiration = ({ aspiration = null, actionTag = '', baseScore = 0 } = {}) => {
    const profile = aspiration?.behaviorProfile || {};
    const bias = profile.decisionBias || {};
    const preferred = new Set(profile.preferredActions || []);
    const avoid = new Set(profile.avoidActions || []);

    let score = Number(baseScore) || 0;
    const reasons = [];

    // decisionBias에 같은 actionTag가 있으면 가중치로 반영한다.
    if (Object.prototype.hasOwnProperty.call(bias, actionTag)) {
      const weight = Number(bias[actionTag]) || 0;
      score += weight * 100;
      reasons.push(`bias(${actionTag})=${weight}`);
    }

    if (preferred.has(actionTag)) {
      score += 25;
      reasons.push('preferredActions 보너스(+25)');
    }

    if (avoid.has(actionTag)) {
      score -= 35;
      reasons.push('avoidActions 페널티(-35)');
    }

    return {
      score,
      reasons,
      directive: profile.longTermDirective || ''
    };
  };

  // 행동 후보들 중 최고 점수 액션을 선택한다.
  const chooseActionByAspiration = ({ aspiration = null, candidates = [] } = {}) => {
    const evaluated = (candidates || []).map((candidate) => {
      const tag = candidate?.tag || '';
      const baseScore = candidate?.baseScore || 0;
      const result = scoreActionByAspiration({ aspiration, actionTag: tag, baseScore });
      return {
        ...candidate,
        score: result.score,
        reasons: result.reasons,
        directive: result.directive
      };
    });

    evaluated.sort((a, b) => b.score - a.score);
    return {
      best: evaluated[0] || null,
      ranked: evaluated
    };
  };



  const SAVE_SCHEMA_VERSION = '1.0.0';

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const normalizeCharacterRuntimeState = (character = {}) => {
    const next = clone(character);
    if (!next.wallet) next.wallet = { gold: 0, silver: 0, copper: 0 };
    if (!next.location) next.location = { regionId: '', tile: { x: 0, y: 0, z: 0 }, landmarkId: '' };
    if (!next.inventory) next.inventory = { maxSlots: 20, items: [] };
    if (!next.aspiration) next.aspiration = { currentId: null, poolId: 1 };
    return next;
  };

  // 상태 변경 API
  // - 모든 변경 API는 불변 객체를 반환한다.
  // - 호출부에서 저장 dirty 처리/로그 적재를 하도록 설계한다.
  const applyCurrencyDelta = (character = {}, delta = {}) => {
    const next = normalizeCharacterRuntimeState(character);
    ['gold', 'silver', 'copper'].forEach((key) => {
      const change = Number(delta[key] ?? 0);
      if (!Number.isFinite(change)) return;
      next.wallet[key] = Math.max(0, Number(next.wallet[key] || 0) + change);
    });
    return next;
  };

  const moveCharacterLocation = (character = {}, locationPatch = {}) => {
    const next = normalizeCharacterRuntimeState(character);
    next.location.regionId = locationPatch.regionId ?? next.location.regionId;
    next.location.landmarkId = locationPatch.landmarkId ?? next.location.landmarkId;
    next.location.tile = {
      x: Number(locationPatch?.tile?.x ?? next.location?.tile?.x ?? 0),
      y: Number(locationPatch?.tile?.y ?? next.location?.tile?.y ?? 0),
      z: Number(locationPatch?.tile?.z ?? next.location?.tile?.z ?? 0)
    };
    return next;
  };

  const addInventoryItem = (character = {}, itemId = '', qty = 1) => {
    const next = normalizeCharacterRuntimeState(character);
    const amount = Number(qty);
    if (!itemId || !Number.isFinite(amount) || amount <= 0) return next;

    const existing = next.inventory.items.find((item) => item.itemId === itemId);
    if (existing) {
      existing.qty += amount;
      return next;
    }

    if (next.inventory.items.length >= Number(next.inventory.maxSlots || 0)) return next;
    next.inventory.items.push({ itemId, qty: amount });
    return next;
  };

  const removeInventoryItem = (character = {}, itemId = '', qty = 1) => {
    const next = normalizeCharacterRuntimeState(character);
    const amount = Number(qty);
    if (!itemId || !Number.isFinite(amount) || amount <= 0) return next;

    const target = next.inventory.items.find((item) => item.itemId === itemId);
    if (!target) return next;

    target.qty -= amount;
    next.inventory.items = next.inventory.items.filter((item) => item.qty > 0);
    return next;
  };

  // 저장/불러오기 직렬화 규칙
  // - saveSchemaVersion을 명시해 마이그레이션 기준점으로 사용한다.
  // - runtime 전용 캐시 값은 payload에 넣지 않는다.
  const serializeCharacterState = (character = {}) => {
    const normalized = normalizeCharacterRuntimeState(character);
    return {
      saveSchemaVersion: SAVE_SCHEMA_VERSION,
      payload: {
        id: normalized.id,
        actorId: normalized.actorId,
        wallet: normalized.wallet,
        location: normalized.location,
        inventory: normalized.inventory,
        aspiration: normalized.aspiration,
        traits: normalized.traits,
        familyLinks: normalized.familyLinks
      }
    };
  };

  const deserializeCharacterState = (saveBlob = {}) => {
    const version = String(saveBlob?.saveSchemaVersion || '1.0.0');
    const payload = clone(saveBlob?.payload || {});

    // 버전별 마이그레이션 포인트
    if (version === '1.0.0') {
      return normalizeCharacterRuntimeState(payload);
    }

    // 알 수 없는 버전은 최대한 안전하게 정규화해 반환한다.
    return normalizeCharacterRuntimeState(payload);
  };

  global.NewtheriaCharacterDataUtils = {
    validateCharacterData,
    buildCharacterIndexes,
    scoreActionByAspiration,
    chooseActionByAspiration,
    applyCurrencyDelta,
    moveCharacterLocation,
    addInventoryItem,
    removeInventoryItem,
    serializeCharacterState,
    deserializeCharacterState,
    SAVE_SCHEMA_VERSION
  };
}(window));
