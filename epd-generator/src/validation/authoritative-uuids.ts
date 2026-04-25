// Pure builder for the authoritative-UUID set. No browser-only imports —
// safe to use in vitest. The browser entry point that wires `?raw` CSV imports
// lives in `src/schema/browser-registry.ts`.
import type {
  CommonReference,
  FlowProperty,
  BackgroundDatabase,
  Indicator,
  CountryIndicator,
} from '../schema/types';

export interface AuthoritativeCatalogue {
  commonReferences: CommonReference[];
  flowProperties: FlowProperty[];
  backgroundDatabases: BackgroundDatabase[];
  indicators: Indicator[];
  countryIndicators: CountryIndicator[];
}

export function buildAuthoritativeUuids(c: AuthoritativeCatalogue): Set<string> {
  const ids = new Set<string>();
  for (const r of c.commonReferences) if (r.uuid) ids.add(r.uuid);
  for (const fp of c.flowProperties) {
    if (fp.flowPropertyUuid) ids.add(fp.flowPropertyUuid);
    if (fp.referenceUnitGroupUuid) ids.add(fp.referenceUnitGroupUuid);
  }
  for (const db of c.backgroundDatabases) if (db.uuid) ids.add(db.uuid);
  for (const i of c.indicators) {
    if (i.uuid) ids.add(i.uuid);
    if (i.unitGroupUuid) ids.add(i.unitGroupUuid);
  }
  for (const i of c.countryIndicators) {
    if (i.uuid) ids.add(i.uuid);
    if (i.unitGroupUuid) ids.add(i.unitGroupUuid);
  }
  return ids;
}
