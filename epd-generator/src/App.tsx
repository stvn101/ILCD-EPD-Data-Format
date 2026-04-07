import { WizardShell } from './components/WizardShell';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">EPD Generator</h1>
          <p className="text-sm text-gray-500">ILCD+EPD v1.3 Dataset Creator</p>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <WizardShell />
      </main>
    </div>
  );
}
