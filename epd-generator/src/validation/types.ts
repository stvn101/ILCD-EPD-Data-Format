import type { Indicator } from '../schema/types';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: ValidationSeverity;
  step: number;
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidationContext {
  authoritativeUuids?: Set<string>;
  lciaIndicators?: Indicator[];
}
