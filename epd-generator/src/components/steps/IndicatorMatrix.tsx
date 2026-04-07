import type { Indicator } from '../../schema/types';
import type { ModuleName } from '../../schema/types';

interface IndicatorMatrixProps {
  title: string;
  indicators: Indicator[];
  modules: ModuleName[];
  values: Map<string, Map<string, number>>;
  onChange: (indicatorUuid: string, module: ModuleName, value: number) => void;
}

/**
 * Extract short name from parentheses, e.g.
 * "Global Warming Potential (GWP)" -> "GWP"
 * Returns the original name if no parenthetical found.
 */
function extractShortName(fullName: string): string {
  const match = fullName.match(/\(([^)]+)\)\s*$/);
  return match ? match[1] : fullName;
}

export default function IndicatorMatrix({
  title,
  indicators,
  modules,
  values,
  onChange,
}: IndicatorMatrixProps) {
  if (indicators.length === 0 || modules.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {/* Sticky first column header */}
              <th
                className="sticky left-0 z-10 bg-gray-50 px-4 py-2 text-left font-semibold text-gray-700 border-r border-gray-200 min-w-[200px] whitespace-nowrap"
              >
                Indicator
              </th>
              {/* Unit column */}
              <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-200 whitespace-nowrap">
                Unit
              </th>
              {/* Module columns */}
              {modules.map((mod) => (
                <th
                  key={mod}
                  className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-200 whitespace-nowrap last:border-r-0"
                >
                  {mod}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {indicators.map((indicator, rowIdx) => {
              const shortName = extractShortName(indicator.nameEn);
              const indicatorValues = values.get(indicator.uuid);

              return (
                <tr
                  key={indicator.uuid}
                  className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                >
                  {/* Sticky indicator name cell */}
                  <td
                    className="sticky left-0 z-10 px-4 py-1.5 border-r border-gray-200 font-medium text-gray-800 whitespace-nowrap"
                    style={{
                      backgroundColor: rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb',
                    }}
                    title={indicator.nameEn}
                  >
                    {shortName}
                  </td>
                  {/* Unit cell */}
                  <td className="px-3 py-1.5 text-center text-gray-500 border-r border-gray-200 whitespace-nowrap">
                    {indicator.unitEn}
                  </td>
                  {/* Value cells per module */}
                  {modules.map((mod) => {
                    const currentValue = indicatorValues?.get(mod);
                    return (
                      <td
                        key={mod}
                        className="px-1 py-1 border-r border-gray-200 last:border-r-0"
                      >
                        <input
                          type="number"
                          step="any"
                          value={currentValue ?? ''}
                          onChange={(e) => {
                            const parsed = parseFloat(e.target.value);
                            if (!isNaN(parsed)) {
                              onChange(indicator.uuid, mod, parsed);
                            } else if (e.target.value === '' || e.target.value === '-') {
                              onChange(indicator.uuid, mod, 0);
                            }
                          }}
                          aria-label={`${shortName} ${mod}`}
                          className="w-24 px-2 py-1 text-right text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0"
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
