window.NewtheriaDialogueRepository = (() => {
  const defaultLocale = 'ko';
  const csvUrlDefault = './assets/data/dialogues.csv';

  const fallbackScenes = {
    prologue_intro: {
      ko: {
        characterName: '별의 여신 · 아스테리아',
        nextLabel: '다음',
        completeLabel: '여정 시작',
        skipLabel: '스킵',
        lines: [
          '깨어났구나, 여행자여. 별들이 너의 이름을 속삭이고 있단다.',
          '이제 네가 걷는 한 걸음마다 새로운 시대의 지도가 그려질 것이다.',
          '두려워하지 말거라. 내가 너의 첫 여정을 축복하겠다.'
        ]
      }
    }
  };

  let scenes = JSON.parse(JSON.stringify(fallbackScenes));
  let initialized = false;

  const parseCsvLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];

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
        values.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current.trim());
    return values;
  };

  const parseCsv = (text) => {
    const lines = text
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) return [];

    const header = parseCsvLine(lines[0]);
    return lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      const row = {};
      header.forEach((key, index) => {
        row[key] = values[index] ?? '';
      });
      return row;
    });
  };

  const buildScenesFromRows = (rows) => {
    const sceneMap = {};
    rows.forEach((row) => {
      const sceneId = row.scene_id;
      const locale = row.locale || defaultLocale;
      if (!sceneId) return;

      if (!sceneMap[sceneId]) sceneMap[sceneId] = {};
      if (!sceneMap[sceneId][locale]) {
        sceneMap[sceneId][locale] = {
          characterName: row.character_name || '',
          nextLabel: row.next_label || '',
          completeLabel: row.complete_label || '',
          skipLabel: row.skip_label || '',
          lines: []
        };
      }

      sceneMap[sceneId][locale].lines.push({
        order: Number.parseInt(row.line_order || '0', 10) || 0,
        text: row.line_text || ''
      });
    });

    Object.values(sceneMap).forEach((locales) => {
      Object.values(locales).forEach((scene) => {
        scene.lines = scene.lines
          .sort((a, b) => a.order - b.order)
          .map((line) => line.text)
          .filter((line) => line.length > 0);
      });
    });

    return sceneMap;
  };

  const mergeScenes = (nextScenes) => {
    scenes = {
      ...scenes,
      ...nextScenes
    };
  };

  const loadFromCsv = async (csvUrl = csvUrlDefault) => {
    const response = await fetch(csvUrl, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Failed to load dialogue CSV: ${response.status}`);
    }

    const text = await response.text();
    const rows = parseCsv(text);
    const csvScenes = buildScenesFromRows(rows);
    mergeScenes(csvScenes);
  };

  const initialize = async ({ csvUrl = csvUrlDefault } = {}) => {
    if (initialized) return;
    try {
      await loadFromCsv(csvUrl);
    } catch (error) {
      console.warn('[DialogueRepository] CSV load failed. Fallback scenes will be used.', error);
    }
    initialized = true;
  };

  const getScene = (sceneId, locale) => {
    const scene = scenes?.[sceneId];
    if (!scene) return null;
    return scene[locale] || scene[defaultLocale] || null;
  };

  return {
    defaultLocale,
    initialize,
    getScene,
    loadFromCsv
  };
})();
