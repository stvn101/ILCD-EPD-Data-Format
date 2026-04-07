import React from 'react';
import { useEPDStore } from '../../store/epd-store';
import { STANDARD_CONFIGS, EPD_SUB_TYPES } from '../../schema/standard-configs';
import type { StandardVersion, EPDSubType } from '../../schema/types';

interface StandardOption {
  version: StandardVersion;
  label: string;
  description: string;
}

const STANDARD_OPTIONS: StandardOption[] = [
  {
    version: '+A1',
    label: 'EN 15804+A1',
    description: '24 indicators, basic scenarios',
  },
  {
    version: '+A2/EF3.0',
    label: 'EN 15804+A2 (EF 3.0)',
    description: '37 indicators, content declaration, variability',
  },
  {
    version: '+A2/EF3.1',
    label: 'EN 15804+A2 (EF 3.1)',
    description: '37 indicators, full v1.3 features (service life, SVHC, manufacturer sites)',
  },
];

export default function Step1StandardType() {
  const dataset = useEPDStore((s) => s.dataset);
  const setStandardVersion = useEPDStore((s) => s.setStandardVersion);
  const updateDataset = useEPDStore((s) => s.updateDataset);

  const selectedVersion = dataset.meta.standardVersion as StandardVersion;
  const selectedSubType = dataset.meta.subType as EPDSubType | undefined;

  const config = STANDARD_CONFIGS[selectedVersion];

  const handleVersionChange = (version: StandardVersion) => {
    setStandardVersion(version);
  };

  const handleSubTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateDataset({
      meta: {
        ...dataset.meta,
        subType: e.target.value as EPDSubType,
      },
    });
  };

  const featureRows: { key: keyof typeof config.features; label: string }[] = [
    { key: 'contentDeclaration', label: 'Content Declaration' },
    { key: 'variability', label: 'Variability' },
    { key: 'serviceLife', label: 'Service Life' },
    { key: 'svhc', label: 'SVHC Substances' },
    { key: 'manufacturers', label: 'Manufacturer Sites' },
    { key: 'productIds', label: 'Product IDs' },
    { key: 'scenarioData', label: 'Scenario Data' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Standard &amp; Type</h2>
        <p className="text-sm text-gray-500">
          Select the EN 15804 standard version and EPD sub-type for this dataset.
        </p>
      </div>

      {/* Standard Version Selection */}
      <fieldset>
        <legend className="text-sm font-semibold text-gray-700 mb-3">Standard Version</legend>
        <div className="space-y-3">
          {STANDARD_OPTIONS.map((option) => {
            const isSelected = selectedVersion === option.version;
            return (
              <label
                key={option.version}
                className={`
                  flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors
                  ${isSelected
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                  }
                `}
              >
                <input
                  type="radio"
                  name="standardVersion"
                  value={option.version}
                  checked={isSelected}
                  onChange={() => handleVersionChange(option.version)}
                  className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  aria-label={`${option.label}: ${option.description}`}
                />
                <div className="flex-1 min-w-0">
                  <span className={`block text-sm font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                    {option.label}
                  </span>
                  <span className="block text-sm text-gray-500 mt-0.5">{option.description}</span>
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* EPD Sub-Type */}
      <div>
        <label htmlFor="epdSubType" className="block text-sm font-semibold text-gray-700 mb-2">
          EPD Sub-Type
        </label>
        <select
          id="epdSubType"
          value={selectedSubType ?? ''}
          onChange={handleSubTypeChange}
          className="block w-full max-w-sm rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="" disabled>
            Select a sub-type...
          </option>
          {EPD_SUB_TYPES.map((subType) => (
            <option key={subType} value={subType}>
              {subType.charAt(0).toUpperCase() + subType.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Configuration Summary */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Configuration Summary</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-4">
          {featureRows.map(({ key, label }) => {
            const enabled = config.features[key];
            return (
              <div key={key} className="flex items-center gap-2">
                <span
                  className={`flex-shrink-0 h-4 w-4 rounded-full flex items-center justify-center ${
                    enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                  }`}
                  aria-hidden="true"
                >
                  {enabled ? (
                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </span>
                <span className={`text-xs ${enabled ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
              </div>
            );
          })}
        </div>
        <div className="pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            <span className="font-medium">Namespaces:</span>{' '}
            {config.namespaces.join(', ')}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            <span className="font-medium">Data format refs:</span>{' '}
            {config.dataFormatRefs.map((r) => r.name).join(', ')}
          </p>
        </div>
      </div>
    </div>
  );
}
