import React, { useMemo } from 'react';
import { useEPDStore } from '../../store/epd-store';
import type { MultiLangString, Reference, FlowProperty } from '../../schema/types';
import type { MatMLProperty, MatMLPropertyName } from '../../model/epd-dataset';
import { parseFlowPropertiesCSV } from '../../schema/indicator-parser';
// Static ?raw import resolved by Vite at bundle time.
import flowPropertiesCSV from '../../../../ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/Flow_properties_and_unit_groups.csv?raw';

function getLang(arr: MultiLangString[], lang: string): string {
  return arr.find((m) => m.lang === lang)?.value ?? '';
}

function setLang(arr: MultiLangString[], lang: string, value: string): MultiLangString[] {
  const existing = arr.filter((m) => m.lang !== lang);
  if (value === '') return existing;
  return [...existing, { lang, value }];
}

interface DeclaredUnitOption {
  label: string;
  unit: string;
  flowPropertyRef: string;
  unitGroupRef: string;
}

function buildDeclaredUnitOptions(properties: FlowProperty[]): DeclaredUnitOption[] {
  return properties
    .filter((p) => p.flowPropertyUuid && p.referenceUnitGroupUuid && p.referenceUnit)
    .map((p) => ({
      label: `${p.flowProperty} (${p.referenceUnit})`,
      unit: p.referenceUnit,
      flowPropertyRef: p.flowPropertyUuid,
      unitGroupRef: p.referenceUnitGroupUuid,
    }));
}

const MATERIAL_PROPERTY_NAMES: MatMLPropertyName[] = [
  'gross density',
  'grammage',
  'bulk density',
  'layer thickness',
  'productiveness',
  'linear density',
];

function makeRef(type: string, uuid: string, desc: string): Reference {
  return { type, refObjectId: uuid, shortDescription: [{ lang: 'en', value: desc }] };
}

export default function Step3ProductFlow() {
  const productFlow = useEPDStore((s) => s.dataset.productFlow);
  const updateProductFlow = useEPDStore((s) => s.updateProductFlow);

  const declaredUnitOptions = useMemo(
    () => buildDeclaredUnitOptions(parseFlowPropertiesCSV(flowPropertiesCSV)),
    []
  );

  const nameEn = getLang(productFlow.name, 'en');

  const selectedUnitKey =
    declaredUnitOptions.find(
      (o) => o.flowPropertyRef === productFlow.declaredUnit.flowPropertyRef.refObjectId
    )?.flowPropertyRef ?? '';

  const inputClass =
    'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500';
  const labelClass = 'block text-sm font-semibold text-gray-700 mb-1';

  function handleUnitChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const opt = declaredUnitOptions.find((o) => o.flowPropertyRef === e.target.value);
    if (!opt) return;
    updateProductFlow({
      declaredUnit: {
        flowPropertyRef: makeRef('flow property data set', opt.flowPropertyRef, opt.label),
        unitGroupRef: makeRef('unit group data set', opt.unitGroupRef, opt.unit),
      },
    });
  }

  function addProperty() {
    updateProductFlow({
      materialProperties: [
        ...productFlow.materialProperties,
        { propertyName: 'gross density', value: 0, materialName: '' },
      ],
    });
  }

  function removeProperty(index: number) {
    const updated = productFlow.materialProperties.filter((_, i) => i !== index);
    updateProductFlow({ materialProperties: updated });
  }

  function updateProperty(index: number, patch: Partial<MatMLProperty>) {
    const updated = productFlow.materialProperties.map((p, i) =>
      i === index ? { ...p, ...patch } : p
    );
    updateProductFlow({ materialProperties: updated });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Product Flow</h2>
        <p className="text-sm text-gray-500">
          Define the declared product flow and its unit of measurement.
        </p>
      </div>

      <div className="space-y-5">
        {/* Product flow name */}
        <div>
          <label htmlFor="productFlow.name" className={labelClass}>
            Product flow name (en)
          </label>
          <input
            id="productFlow.name"
            type="text"
            value={nameEn}
            onChange={(e) =>
              updateProductFlow({ name: setLang(productFlow.name, 'en', e.target.value) })
            }
            className={inputClass}
            aria-label="Product flow name (English)"
          />
        </div>

        {/* Declared unit */}
        <div>
          <label htmlFor="declaredUnit" className={labelClass}>
            Declared unit
          </label>
          <select
            id="declaredUnit"
            value={selectedUnitKey}
            onChange={handleUnitChange}
            className={`${inputClass} max-w-sm`}
            aria-label="Declared unit"
          >
            <option value="" disabled>
              Select a unit...
            </option>
            {declaredUnitOptions.map((opt) => (
              <option key={opt.flowPropertyRef} value={opt.flowPropertyRef}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Material properties */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className={labelClass}>Material properties</span>
            <button
              type="button"
              onClick={addProperty}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none"
            >
              + Add property
            </button>
          </div>

          {productFlow.materialProperties.length === 0 && (
            <p className="text-sm text-gray-400 italic">No material properties added.</p>
          )}

          <div className="space-y-3">
            {productFlow.materialProperties.map((prop, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto_1fr_auto] gap-3 items-center rounded-lg border border-gray-200 bg-gray-50 p-3"
              >
                {/* Property name dropdown */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Property</label>
                  <select
                    value={prop.propertyName}
                    onChange={(e) =>
                      updateProperty(i, { propertyName: e.target.value as MatMLPropertyName })
                    }
                    className={inputClass}
                    aria-label={`Material property name ${i + 1}`}
                  >
                    {MATERIAL_PROPERTY_NAMES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Value */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Value</label>
                  <input
                    type="number"
                    value={prop.value}
                    onChange={(e) => updateProperty(i, { value: Number(e.target.value) })}
                    className={`${inputClass} w-28`}
                    aria-label={`Material property value ${i + 1}`}
                  />
                </div>

                {/* Material name */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Material name</label>
                  <input
                    type="text"
                    value={prop.materialName}
                    onChange={(e) => updateProperty(i, { materialName: e.target.value })}
                    className={inputClass}
                    aria-label={`Material name ${i + 1}`}
                  />
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeProperty(i)}
                  className="mt-5 text-red-400 hover:text-red-600 focus:outline-none text-lg leading-none"
                  aria-label={`Remove material property ${i + 1}`}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
