#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const poolsPath = path.join(root, 'assets/data/character_common_pools.json');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf-8'));

const cleanId = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const ensureUniqueIds = (items, label, errors) => {
  const seen = new Set();
  items.forEach((item) => {
    const id = cleanId(item?.id);
    if (id == null) {
      errors.push(`${label}: invalid id (${item?.id})`);
      return;
    }
    if (seen.has(id)) {
      errors.push(`${label}: duplicated id (${id})`);
      return;
    }
    seen.add(id);
  });
};

const main = () => {
  const errors = [];
  const pools = readJson(poolsPath);

  ensureUniqueIds(pools.innateTraitCatalog || [], 'innateTraitCatalog', errors);
  ensureUniqueIds(pools.aspirationPoolCatalog || [], 'aspirationPoolCatalog', errors);
  ensureUniqueIds(pools.aspirationDefinitions || [], 'aspirationDefinitions', errors);

  const aspirationIds = new Set((pools.aspirationDefinitions || []).map((a) => cleanId(a.id)).filter((id) => id != null));

  (pools.aspirationPoolCatalog || []).forEach((pool) => {
    const poolId = cleanId(pool?.id);
    (pool?.aspirationIds || []).forEach((aspIdRaw) => {
      const aspId = cleanId(aspIdRaw);
      if (aspId == null || !aspirationIds.has(aspId)) {
        errors.push(`pool(${poolId}) has unknown aspirationId: ${aspIdRaw}`);
      }
    });
  });

  if (errors.length > 0) {
    console.error('Character data validation failed:');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log('Character data validation passed.');
};

main();
