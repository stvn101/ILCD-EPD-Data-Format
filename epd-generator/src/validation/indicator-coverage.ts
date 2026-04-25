import type { EPDDataset } from '../model/epd-dataset';
import type { Indicator } from '../schema/types';
import type { ValidationIssue } from './types';

/**
 * For each declared module × LCIA indicator, warn if the dataset has no
 * `LCIAResult` for that indicator UUID with an `amounts` entry for that module.
 */
export function findIndicatorCoverageGaps(
  dataset: EPDDataset,
  lciaIndicators: Indicator[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (dataset.declaredModules.size === 0) return issues;

  const resultByUuid = new Map<string, Set<string>>();
  for (const r of dataset.lciaResults) {
    const uuid = r.methodRef?.refObjectId;
    if (!uuid) continue;
    const modules = resultByUuid.get(uuid) ?? new Set<string>();
    for (const a of r.amounts) modules.add(a.module);
    resultByUuid.set(uuid, modules);
  }

  for (const ind of lciaIndicators) {
    const modules = resultByUuid.get(ind.uuid);
    for (const m of dataset.declaredModules) {
      if (modules?.has(m)) continue;
      issues.push({
        severity: 'warning',
        step: 5,
        field: `lciaResults.${ind.uuid}.${m}`,
        message: `Missing ${ind.nameEn} (${ind.unitEn}) for module ${m}.`,
      });
    }
  }

  return issues;
}
