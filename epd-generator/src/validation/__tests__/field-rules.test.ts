import { describe, it, expect } from 'vitest';
import { validateField } from '../field-rules';

describe('validateField', () => {
  it('returns error for empty required field', () => {
    expect(validateField('processInfo.name', '')).toBe('Product name is required');
    expect(validateField('processInfo.name', '  ')).toBe('Product name is required');
  });

  it('returns null for valid required field', () => {
    expect(validateField('processInfo.name', 'Wood Panel')).toBeNull();
  });

  it('returns null for unknown field', () => {
    expect(validateField('unknown.field', '')).toBeNull();
  });

  it('validates pattern', () => {
    expect(validateField('meta.dataSetVersion', '00.01.000')).toBeNull();
    expect(validateField('meta.dataSetVersion', 'bad')).toBe('Version must be in format 00.01.000');
  });

  it('returns error for missing required number', () => {
    expect(validateField('processInfo.referenceYear', null)).toBe('Reference year is required');
    expect(validateField('processInfo.referenceYear', 0)).toBe('Reference year is required');
  });
});
