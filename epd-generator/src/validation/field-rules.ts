export interface FieldRule {
  required?: boolean;
  minLength?: number;
  pattern?: RegExp;
  message: string;
}

export const FIELD_RULES: Record<string, FieldRule> = {
  'processInfo.name': { required: true, minLength: 1, message: 'Product name is required' },
  'processInfo.location': { required: false, message: 'Location is recommended' },
  'processInfo.referenceYear': { required: true, message: 'Reference year is required' },
  'meta.dataSetVersion': { required: true, pattern: /^\d{2}\.\d{2}\.\d{3}$/, message: 'Version must be in format 00.01.000' },
};

export function validateField(fieldId: string, value: any): string | null {
  const rule = FIELD_RULES[fieldId];
  if (!rule) return null;

  if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
    return rule.message;
  }
  if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
    return rule.message;
  }
  if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
    return rule.message;
  }
  return null;
}
