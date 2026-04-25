import { Suspense, lazy } from 'react';
import { useEPDStore } from '../store/epd-store';
import { WizardStepIndicator } from './WizardStepIndicator';

const Step1StandardType = lazy(() => import('./steps/Step1StandardType'));
const Step2ProductInfo = lazy(() => import('./steps/Step2ProductInfo'));
const Step3ProductFlow = lazy(() => import('./steps/Step3ProductFlow'));
const Step4Organisations = lazy(() => import('./steps/Step4Organisations'));
const Step5LifecycleModules = lazy(() => import('./steps/Step5LifecycleModules'));
const Step6Sources = lazy(() => import('./steps/Step6Sources'));
const Step7ReviewExport = lazy(() => import('./steps/Step7ReviewExport'));

const STEP_COMPONENTS = [
  Step1StandardType,
  Step2ProductInfo,
  Step3ProductFlow,
  Step4Organisations,
  Step5LifecycleModules,
  Step6Sources,
  Step7ReviewExport,
];

const TOTAL_STEPS = STEP_COMPONENTS.length;

export function WizardShell() {
  const currentStep = useEPDStore((s) => s.currentStep);
  const setStep = useEPDStore((s) => s.setStep);

  const StepComponent = STEP_COMPONENTS[currentStep];

  const handlePrevious = () => {
    if (currentStep > 0) setStep(currentStep - 1);
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS - 1) setStep(currentStep + 1);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <WizardStepIndicator currentStep={currentStep} onStepClick={setStep} />

      <div className="min-h-96">
        <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>}>
          <StepComponent />
        </Suspense>
      </div>

      <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
        <button
          onClick={handlePrevious}
          disabled={currentStep === 0}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>

        <span className="text-sm text-gray-500">
          Step {currentStep + 1} of {TOTAL_STEPS}
        </span>

        <button
          onClick={handleNext}
          disabled={currentStep === TOTAL_STEPS - 1}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
