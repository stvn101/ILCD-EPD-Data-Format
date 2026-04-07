import { describe, it, expect } from 'vitest';
import { validateDataset } from '../validator';
import { createEmptyDataset } from '../../model/epd-dataset';

describe('validateDataset', () => {
  it('reports error for missing product name', () => {
    const dataset = createEmptyDataset();
    const result = validateDataset(dataset);
    expect(result.errors.some(e => e.field === 'processInfo.name')).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('reports error for no declared modules', () => {
    const dataset = createEmptyDataset();
    const result = validateDataset(dataset);
    expect(result.errors.some(e => e.field === 'declaredModules')).toBe(true);
  });

  it('reports warnings for missing optional fields', () => {
    const dataset = createEmptyDataset();
    dataset.processInfo.name = [{ lang: 'en', value: 'Test' }];
    dataset.declaredModules = new Set(['A1-A3']);
    const result = validateDataset(dataset);
    expect(result.warnings.some(w => w.field === 'processInfo.location')).toBe(true);
    expect(result.warnings.some(w => w.field === 'sources.pcr')).toBe(true);
  });

  it('valid=true when only warnings exist', () => {
    const dataset = createEmptyDataset();
    dataset.processInfo.name = [{ lang: 'en', value: 'Test Product' }];
    dataset.processInfo.location = 'DE';
    dataset.declaredModules = new Set(['A1-A3']);
    const result = validateDataset(dataset);
    expect(result.valid).toBe(true);
  });

  it('separates errors and warnings', () => {
    const dataset = createEmptyDataset();
    const result = validateDataset(dataset);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.issues.length).toBe(result.errors.length + result.warnings.length);
  });
});
