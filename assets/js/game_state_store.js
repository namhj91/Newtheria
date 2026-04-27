(function attachGameStateStore(global) {
  const cleanText = (value, fallback = '') => {
    if (value == null) return fallback;
    return String(value).trim();
  };

  const toValidStateIdOrNull = (value) => {
    const numeric = Number.parseInt(String(value ?? '').trim(), 10);
    if (!Number.isInteger(numeric)) return null;
    if (numeric < 1) return null;
    return numeric;
  };

  const normalizeSwitchValueOrNull = (value) => {
    if (typeof value === 'boolean') return value;
    const text = cleanText(value).toLowerCase();
    if (['on', 'true', '온', '켜짐'].includes(text)) return true;
    if (['off', 'false', '오프', '꺼짐'].includes(text)) return false;
    return null;
  };

  const normalizeNumberValueOrNull = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const text = cleanText(value);
    if (!text) return null;
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  };

  const createStateStore = () => {
    const state = {
      switchesById: new Map(),
      variablesById: new Map(),
      switchNameToId: new Map(),
      variableNameToId: new Map(),
      nextSwitchId: 1,
      nextVariableId: 1
    };

    const rebuildTemplateBindings = () => {
      // 템플릿 치환용 평면 스냅샷:
      // - 이름 키: {player_name}, {met_goddess}
      // - 보조 id 키: {var_1}, {switch_1}
      const next = {};
      state.variablesById.forEach((item) => {
        const id = toValidStateIdOrNull(item.id);
        const name = cleanText(item.name);
        if (name) next[name] = item.value;
        if (id !== null) next[`var_${id}`] = item.value;
      });
      state.switchesById.forEach((item) => {
        const id = toValidStateIdOrNull(item.id);
        const name = cleanText(item.name);
        if (name) next[name] = Boolean(item.value);
        if (id !== null) next[`switch_${id}`] = Boolean(item.value);
      });
      return next;
    };

    const registerVariableDefinition = ({
      id = null,
      name = '',
      description = '',
      value = 0
    } = {}) => {
      const normalizedName = cleanText(name);
      if (!normalizedName) return null;
      const requestedId = toValidStateIdOrNull(id);
      const resolvedId = requestedId ?? state.nextVariableId;
      if (resolvedId < 1) return null;
      state.nextVariableId = Math.max(state.nextVariableId, resolvedId + 1);
      const existingByNameId = state.variableNameToId.get(normalizedName);
      const finalId = existingByNameId ?? resolvedId;
      const prev = state.variablesById.get(finalId);
      const normalizedValue = normalizeNumberValueOrNull(value);
      const fallbackValue = normalizeNumberValueOrNull(prev?.value);
      state.variablesById.set(finalId, {
        id: finalId,
        name: normalizedName,
        description: cleanText(description),
        value: normalizedValue ?? fallbackValue ?? 0
      });
      state.variableNameToId.set(normalizedName, finalId);
      return finalId;
    };

    const registerSwitchDefinition = ({
      id = null,
      name = '',
      description = '',
      value = false
    } = {}) => {
      const normalizedName = cleanText(name);
      if (!normalizedName) return null;
      const requestedId = toValidStateIdOrNull(id);
      const resolvedId = requestedId ?? state.nextSwitchId;
      if (resolvedId < 1) return null;
      state.nextSwitchId = Math.max(state.nextSwitchId, resolvedId + 1);
      const existingByNameId = state.switchNameToId.get(normalizedName);
      const finalId = existingByNameId ?? resolvedId;
      const prev = state.switchesById.get(finalId);
      const normalizedValue = normalizeSwitchValueOrNull(value);
      const fallbackValue = normalizeSwitchValueOrNull(prev?.value);
      state.switchesById.set(finalId, {
        id: finalId,
        name: normalizedName,
        description: cleanText(description),
        value: normalizedValue ?? fallbackValue ?? false
      });
      state.switchNameToId.set(normalizedName, finalId);
      return finalId;
    };

    const resolveVariableId = (idOrName) => {
      const asId = toValidStateIdOrNull(idOrName);
      if (asId !== null) return asId;
      const asName = cleanText(idOrName);
      if (!asName) return null;
      return state.variableNameToId.get(asName) ?? null;
    };

    const resolveSwitchId = (idOrName) => {
      const asId = toValidStateIdOrNull(idOrName);
      if (asId !== null) return asId;
      const asName = cleanText(idOrName);
      if (!asName) return null;
      return state.switchNameToId.get(asName) ?? null;
    };

    const defineVariables = (definitions = []) => {
      const list = Array.isArray(definitions) ? definitions : [];
      list.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        registerVariableDefinition({
          id: item.id,
          name: item.name,
          description: item.description,
          value: item.value
        });
      });
    };

    const defineSwitches = (definitions = []) => {
      const list = Array.isArray(definitions) ? definitions : [];
      list.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        registerSwitchDefinition({
          id: item.id,
          name: item.name,
          description: item.description,
          value: item.value
        });
      });
    };

    const setVariable = (idOrName, value) => {
      const resolvedId = resolveVariableId(idOrName);
      if (resolvedId === null) return false;
      const current = state.variablesById.get(resolvedId);
      if (!current) return false;
      const normalizedValue = normalizeNumberValueOrNull(value);
      if (normalizedValue === null) return false;
      state.variablesById.set(resolvedId, { ...current, value: normalizedValue });
      return true;
    };

    const setSwitch = (idOrName, value) => {
      const resolvedId = resolveSwitchId(idOrName);
      if (resolvedId === null) return false;
      const current = state.switchesById.get(resolvedId);
      if (!current) return false;
      const normalizedValue = normalizeSwitchValueOrNull(value);
      if (normalizedValue === null) return false;
      state.switchesById.set(resolvedId, { ...current, value: normalizedValue });
      return true;
    };

    const setVariablesByName = (patch = {}) => {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return;
      Object.entries(patch).forEach(([name, value]) => {
        const normalizedName = cleanText(name);
        if (!normalizedName) return;
        const existingId = state.variableNameToId.get(normalizedName);
        const resolvedId = existingId ?? registerVariableDefinition({
          name: normalizedName,
          description: '',
          value
        });
        if (resolvedId == null) return;
        setVariable(resolvedId, value);
      });
    };

    const getState = () => ({
      variables: Array.from(state.variablesById.values()).map((item) => ({ ...item })),
      switches: Array.from(state.switchesById.values()).map((item) => ({ ...item }))
    });

    return {
      defineVariables,
      defineSwitches,
      setVariable,
      setSwitch,
      setVariablesByName,
      getTemplateBindings: rebuildTemplateBindings,
      getState
    };
  };

  const stores = new Map();
  const getStore = (storeId = 'global') => {
    const key = cleanText(storeId, 'global') || 'global';
    if (!stores.has(key)) {
      stores.set(key, createStateStore());
    }
    return stores.get(key);
  };

  global.NewtheriaGameStateStore = {
    getStore
  };
})(window);
