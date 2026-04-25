import type { EPDDataset } from '../model/epd-dataset';
import type { ValidationContext, ValidationIssue, ValidationResult } from './types';
import { findUnresolvedReferences, getBundledUuids } from './cross-reference';
import { findIndicatorCoverageGaps } from './indicator-coverage';

export function validateDataset(
  dataset: EPDDataset,
  context?: ValidationContext,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // --- Errors (block export) ---

  // meta.standardVersion must be set
  if (!dataset.meta.standardVersion) {
    issues.push({
      severity: 'error',
      step: 1,
      field: 'meta.standardVersion',
      message: 'Standard version must be set.',
    });
  }

  // processInfo.name must have at least one non-empty value
  const hasNonEmptyName = dataset.processInfo.name.some((n) => n.value.trim() !== '');
  if (!hasNonEmptyName) {
    issues.push({
      severity: 'error',
      step: 2,
      field: 'processInfo.name',
      message: 'Product name must have at least one non-empty value.',
    });
  }

  // processInfo.referenceYear must be > 0
  if (!dataset.processInfo.referenceYear || dataset.processInfo.referenceYear <= 0) {
    issues.push({
      severity: 'error',
      step: 2,
      field: 'processInfo.referenceYear',
      message: 'Reference year must be greater than 0.',
    });
  }

  // declaredModules must have at least one module
  if (dataset.declaredModules.size === 0) {
    issues.push({
      severity: 'error',
      step: 3,
      field: 'declaredModules',
      message: 'At least one lifecycle module must be declared.',
    });
  }

  // --- Warnings (allow export) ---

  // processInfo.location is recommended
  if (!dataset.processInfo.location || dataset.processInfo.location.trim() === '') {
    issues.push({
      severity: 'warning',
      step: 2,
      field: 'processInfo.location',
      message: 'Location is recommended for EPD completeness.',
    });
  }

  // productFlow.name is recommended
  const hasNonEmptyProductFlowName = dataset.productFlow.name.some((n) => n.value.trim() !== '');
  if (!hasNonEmptyProductFlowName) {
    issues.push({
      severity: 'warning',
      step: 2,
      field: 'productFlow.name',
      message: 'Product flow name is recommended.',
    });
  }

  // exchanges empty when modules are declared
  if (dataset.declaredModules.size > 0 && dataset.exchanges.length === 0) {
    issues.push({
      severity: 'warning',
      step: 5,
      field: 'exchanges',
      message: 'Exchanges are empty but lifecycle modules are declared.',
    });
  }

  // lciaResults empty when modules are declared
  if (dataset.declaredModules.size > 0 && dataset.lciaResults.length === 0) {
    issues.push({
      severity: 'warning',
      step: 6,
      field: 'lciaResults',
      message: 'LCIA results are empty but lifecycle modules are declared.',
    });
  }

  // sources.pcr is recommended
  if (!dataset.sources.pcr) {
    issues.push({
      severity: 'warning',
      step: 4,
      field: 'sources.pcr',
      message: 'A PCR (Product Category Rules) reference is recommended.',
    });
  }

  // Cross-reference: every Reference resolves to a bundled or authoritative UUID
  if (context?.authoritativeUuids) {
    issues.push(
      ...findUnresolvedReferences(dataset, {
        bundled: getBundledUuids(dataset),
        authoritative: context.authoritativeUuids,
      }),
    );
  }

  // Indicator completeness: every declared module × LCIA indicator has a value
  if (context?.lciaIndicators) {
    issues.push(...findIndicatorCoverageGaps(dataset, context.lciaIndicators));
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return {
    valid: errors.length === 0,
    issues,
    errors,
    warnings,
  };
}
