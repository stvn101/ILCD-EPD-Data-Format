import { useState, useCallback } from 'react';
import { validateField } from '../validation/field-rules';

interface Props {
  fieldId: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'textarea';
  placeholder?: string;
  className?: string;
}

export function ValidatedInput({ fieldId, label, value, onChange, type = 'text', placeholder, className }: Props) {
  const [touched, setTouched] = useState(false);
  const error = touched ? validateField(fieldId, value) : null;

  const handleBlur = useCallback(() => setTouched(true), []);

  const inputClasses = `w-full p-2 border rounded-lg ${error ? 'border-red-500 bg-red-50' : 'border-gray-300'} ${className || ''}`;

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={inputClasses}
          rows={3}
          aria-label={label}
          aria-invalid={!!error}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={inputClasses}
          aria-label={label}
          aria-invalid={!!error}
        />
      )}
      {error && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}
    </div>
  );
}
