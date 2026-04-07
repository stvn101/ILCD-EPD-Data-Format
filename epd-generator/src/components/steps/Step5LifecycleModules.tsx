// Static ?raw imports resolved by Vite at bundle time.
// Path: src/components/steps/ -> up 4 levels -> ILCD-EPD-Data-Format-release-v1.3/
// then into the nested ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/
// TODO (Task 15): Replace with a browser-compatible registry that lazy-loads
// the correct CSV based on the selected standard version.
import a1CsvRaw from '../../../../ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/EN15804+A1_indicators.csv?raw';
import a2ef30CsvRaw from '../../../../ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/EN15804+A2_EF3.0_indicators.csv?raw';
import a2ef31CsvRaw from '../../../../ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/EN15804+A2_EF3.1_indicators.csv?raw';

import { useMemo } from 'react';
import { useEPDStore } from '../../store/epd-store';
import { ALL_MODULES } from '../../schema/standard-configs';
import { parseIndicatorCSV } from '../../schema/indicator-parser';
import type { ModuleName, Indicator } from '../../schema/types';
import type { Exchange, LCIAResult } from '../../model/epd-dataset';
import IndicatorMatrix from './IndicatorMatrix';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Determine exchange direction: "Use of..." indicators are Inputs; rest are Outputs. */
function getExchangeDirection(indicator: Indicator): 'Input' | 'Output' {
  return indicator.nameEn.startsWith('Use of') ? 'Input' : 'Output';
}

/**
 * Build a nested Map: indicatorUUID -> module -> value
 * from the exchange/lcia arrays in the dataset.
 */
function buildExchangeValueMap(items: Exchange[]): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  for (const item of items) {
    const uuid = item.flowRef?.refObjectId ?? '';
    if (!uuid) continue;
    const modMap = new Map<string, number>();
    for (const amt of item.amounts) {
      modMap.set(amt.module, amt.value);
    }
    map.set(uuid, modMap);
  }
  return map;
}

function buildLCIAValueMap(items: LCIAResult[]): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  for (const item of items) {
    const uuid = item.methodRef?.refObjectId ?? '';
    if (!uuid) continue;
    const modMap = new Map<string, number>();
    for (const amt of item.amounts) {
      modMap.set(amt.module, amt.value);
    }
    map.set(uuid, modMap);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Step5LifecycleModules() {
  const dataset = useEPDStore((s) => s.dataset);
  const toggleModule = useEPDStore((s) => s.toggleModule);
  const updateDataset = useEPDStore((s) => s.updateDataset);

  const { meta, declaredModules, exchanges, lciaResults } = dataset;
  const standardVersion = meta.standardVersion;

  // Parse the appropriate CSV based on selected standard version
  const indicatorSet = useMemo(() => {
    try {
      let csv: string;
      if (standardVersion === '+A1') {
        csv = a1CsvRaw;
      } else if (standardVersion === '+A2/EF3.0') {
        csv = a2ef30CsvRaw;
      } else {
        csv = a2ef31CsvRaw;
      }
      return parseIndicatorCSV(csv, standardVersion);
    } catch {
      return {
        exchanges: [] as Indicator[],
        lcia: [] as Indicator[],
        all: [] as Indicator[],
        standardVersion,
      };
    }
  }, [standardVersion]);

  const activeModules: ModuleName[] = ALL_MODULES.filter((m) => declaredModules.has(m));

  // Build value maps from current store state
  const exchangeValues = useMemo(() => buildExchangeValueMap(exchanges), [exchanges]);
  const lciaValues = useMemo(() => buildLCIAValueMap(lciaResults), [lciaResults]);

  // -------------------------------------------------------------------------
  // onChange handlers
  // -------------------------------------------------------------------------

  function handleExchangeChange(indicatorUuid: string, module: ModuleName, value: number) {
    const indicator = indicatorSet.exchanges.find((i) => i.uuid === indicatorUuid);
    if (!indicator) return;

    const existing = exchanges.find((e) => e.flowRef.refObjectId === indicatorUuid);
    const direction = getExchangeDirection(indicator);

    if (existing) {
      // Update or add the amount for this module
      const otherAmounts = existing.amounts.filter((a) => a.module !== module);
      const newAmounts = [...otherAmounts, { module, value }];
      const meanAmount =
        newAmounts.reduce((sum, a) => sum + a.value, 0) / (newAmounts.length || 1);

      const newExchanges = exchanges.map((e) =>
        e.flowRef.refObjectId === indicatorUuid
          ? { ...e, amounts: newAmounts, meanAmount }
          : e
      );
      updateDataset({ exchanges: newExchanges });
    } else {
      // Create new exchange entry. dataSetInternalID starts at 43 (42 = reference flow).
      const newId = 43 + exchanges.length;
      const newExchange: Exchange = {
        dataSetInternalID: newId,
        flowRef: {
          type: 'flow data set',
          refObjectId: indicatorUuid,
          version: indicator.version || '00.00.000',
          shortDescription: [{ lang: 'en', value: indicator.nameEn }],
        },
        exchangeDirection: direction,
        meanAmount: value,
        amounts: [{ module, value }],
        unitGroupRef: {
          type: 'unit group data set',
          refObjectId: indicator.unitGroupUuid,
          shortDescription: [{ lang: 'en', value: indicator.unitEn }],
        },
      };
      updateDataset({ exchanges: [...exchanges, newExchange] });
    }
  }

  function handleLCIAChange(indicatorUuid: string, module: ModuleName, value: number) {
    const indicator = indicatorSet.lcia.find((i) => i.uuid === indicatorUuid);
    if (!indicator) return;

    const existing = lciaResults.find((r) => r.methodRef.refObjectId === indicatorUuid);

    if (existing) {
      const otherAmounts = existing.amounts.filter((a) => a.module !== module);
      const newAmounts = [...otherAmounts, { module, value }];
      const meanAmount =
        newAmounts.reduce((sum, a) => sum + a.value, 0) / (newAmounts.length || 1);

      const newResults = lciaResults.map((r) =>
        r.methodRef.refObjectId === indicatorUuid
          ? { ...r, amounts: newAmounts, meanAmount }
          : r
      );
      updateDataset({ lciaResults: newResults });
    } else {
      const newResult: LCIAResult = {
        methodRef: {
          type: 'LCIA method data set',
          refObjectId: indicatorUuid,
          version: indicator.version || '00.00.000',
          shortDescription: [{ lang: 'en', value: indicator.nameEn }],
        },
        meanAmount: value,
        amounts: [{ module, value }],
        unitGroupRef: {
          type: 'unit group data set',
          refObjectId: indicator.unitGroupUuid,
          shortDescription: [{ lang: 'en', value: indicator.unitEn }],
        },
      };
      updateDataset({ lciaResults: [...lciaResults, newResult] });
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Step 5: Lifecycle Modules</h2>
      <p className="text-sm text-gray-600">
        Select the lifecycle modules declared in this EPD, then enter values for each
        indicator in the tables below.
      </p>

      {/* Module toggle buttons */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
          Declared Modules
        </h3>
        <div className="flex flex-wrap gap-2">
          {ALL_MODULES.map((mod) => {
            const isActive = declaredModules.has(mod);
            return (
              <button
                key={mod}
                type="button"
                onClick={() => toggleModule(mod)}
                aria-pressed={isActive}
                className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {mod}
              </button>
            );
          })}
        </div>
      </div>

      {/* Indicator matrices — only shown when at least one module is selected */}
      {activeModules.length > 0 ? (
        <>
          <IndicatorMatrix
            title="LCI Indicators (Exchanges)"
            indicators={indicatorSet.exchanges}
            modules={activeModules}
            values={exchangeValues}
            onChange={handleExchangeChange}
          />
          <IndicatorMatrix
            title="LCIA Impact Indicators"
            indicators={indicatorSet.lcia}
            modules={activeModules}
            values={lciaValues}
            onChange={handleLCIAChange}
          />
        </>
      ) : (
        <p className="text-sm text-gray-500 italic">
          Select at least one module above to enter indicator values.
        </p>
      )}
    </div>
  );
}
