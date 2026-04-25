const STEP_LABELS = [
  'Standard & Type',
  'Product Info',
  'Product Flow',
  'Organisations',
  'Lifecycle Modules',
  'Sources',
  'Review & Export',
];

interface WizardStepIndicatorProps {
  currentStep: number;
  onStepClick: (step: number) => void;
}

export function WizardStepIndicator({ currentStep, onStepClick }: WizardStepIndicatorProps) {
  return (
    <nav aria-label="Wizard progress" className="mb-8">
      <ol className="flex items-center w-full">
        {STEP_LABELS.map((label, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <li
              key={index}
              className={`flex items-center ${index < STEP_LABELS.length - 1 ? 'flex-1' : ''}`}
            >
              <button
                onClick={() => onStepClick(index)}
                aria-label={`Step ${index + 1}: ${label}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex flex-col items-center group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg p-1`}
              >
                <span
                  className={`
                    flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-semibold transition-colors
                    ${isCompleted
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : isCurrent
                      ? 'bg-white border-blue-600 text-blue-600'
                      : 'bg-white border-gray-300 text-gray-400 group-hover:border-gray-400'
                    }
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={`
                    mt-1 text-xs font-medium whitespace-nowrap
                    ${isCompleted
                      ? 'text-blue-600'
                      : isCurrent
                      ? 'text-blue-600'
                      : 'text-gray-400 group-hover:text-gray-500'
                    }
                  `}
                >
                  {label}
                </span>
              </button>
              {index < STEP_LABELS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${index < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
