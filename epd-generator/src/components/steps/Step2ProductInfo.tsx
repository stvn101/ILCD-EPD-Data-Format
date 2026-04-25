import { useEPDStore } from '../../store/epd-store';
import { STANDARD_CONFIGS } from '../../schema/standard-configs';
import type { MultiLangString } from '../../schema/types';
import type { ProductId } from '../../model/epd-dataset';
import { ValidatedInput } from '../ValidatedInput';

function getLang(arr: MultiLangString[], lang: string): string {
  return arr.find((m) => m.lang === lang)?.value ?? '';
}

function setLang(arr: MultiLangString[], lang: string, value: string): MultiLangString[] {
  const existing = arr.filter((m) => m.lang !== lang);
  if (value === '') return existing;
  return [...existing, { lang, value }];
}

export default function Step2ProductInfo() {
  const processInfo = useEPDStore((s) => s.dataset.processInfo);
  const standardVersion = useEPDStore((s) => s.dataset.meta.standardVersion);
  const updateProcessInfo = useEPDStore((s) => s.updateProcessInfo);

  const features = STANDARD_CONFIGS[standardVersion].features;

  const nameEn = getLang(processInfo.name, 'en');
  const nameDe = getLang(processInfo.name, 'de');
  const techDescEn = getLang(processInfo.technologyDescription, 'en');
  const generalCommentEn = getLang(processInfo.generalComment, 'en');

  const productIds: ProductId[] = processInfo.productIds ?? [];

  function addProductId() {
    updateProcessInfo({
      productIds: [...productIds, { type: 'GTIN', value: '' }],
    });
  }
  function updateProductId(i: number, patch: Partial<ProductId>) {
    const updated = productIds.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    updateProcessInfo({ productIds: updated });
  }
  function removeProductId(i: number) {
    updateProcessInfo({ productIds: productIds.filter((_, idx) => idx !== i) });
  }

  const inputClass =
    'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500';
  const labelClass = 'block text-sm font-semibold text-gray-700 mb-1';

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Product Info</h2>
        <p className="text-sm text-gray-500">
          Basic information about the declared product or system.
        </p>
      </div>

      <div className="space-y-5">
        {/* Product name EN */}
        <ValidatedInput
          fieldId="processInfo.name"
          label="Product Name (English)"
          value={nameEn}
          onChange={(val) =>
            updateProcessInfo({ name: setLang(processInfo.name, 'en', val) })
          }
          type="text"
        />

        {/* Product name DE */}
        <div>
          <label htmlFor="nameDe" className={labelClass}>
            Product name (de)
          </label>
          <input
            id="nameDe"
            type="text"
            value={nameDe}
            onChange={(e) =>
              updateProcessInfo({ name: setLang(processInfo.name, 'de', e.target.value) })
            }
            className={inputClass}
            aria-label="Product name (German)"
          />
        </div>

        {/* Reference year & Valid until */}
        <div className="grid grid-cols-2 gap-4">
          <ValidatedInput
            fieldId="processInfo.referenceYear"
            label="Reference Year"
            value={processInfo.referenceYear}
            onChange={(val) =>
              updateProcessInfo({ referenceYear: Number(val) })
            }
            type="number"
          />
          <div>
            <label htmlFor="validUntil" className={labelClass}>
              Valid until
            </label>
            <input
              id="validUntil"
              type="number"
              value={processInfo.validUntil}
              onChange={(e) =>
                updateProcessInfo({ validUntil: Number(e.target.value) })
              }
              className={inputClass}
              aria-label="Valid until year"
            />
          </div>
        </div>

        {/* Location */}
        <div>
          <label htmlFor="processInfo.location" className={labelClass}>
            Location (ISO country code)
          </label>
          <input
            id="processInfo.location"
            type="text"
            value={processInfo.location}
            onChange={(e) => updateProcessInfo({ location: e.target.value })}
            maxLength={3}
            placeholder="e.g. DE"
            className={`${inputClass} max-w-xs uppercase`}
            aria-label="Location (ISO country code)"
          />
        </div>

        {/* Technology description */}
        <div>
          <label htmlFor="techDesc" className={labelClass}>
            Technology description (en)
          </label>
          <textarea
            id="techDesc"
            rows={4}
            value={techDescEn}
            onChange={(e) =>
              updateProcessInfo({
                technologyDescription: setLang(
                  processInfo.technologyDescription,
                  'en',
                  e.target.value
                ),
              })
            }
            className={inputClass}
            aria-label="Technology description (English)"
          />
        </div>

        {/* General comment */}
        <div>
          <label htmlFor="generalComment" className={labelClass}>
            General comment (en)
          </label>
          <textarea
            id="generalComment"
            rows={4}
            value={generalCommentEn}
            onChange={(e) =>
              updateProcessInfo({
                generalComment: setLang(processInfo.generalComment, 'en', e.target.value),
              })
            }
            className={inputClass}
            aria-label="General comment (English)"
          />
        </div>

        {/* Expiration date of EPD (v1.3) */}
        {features.serviceLife && (
          <div>
            <label htmlFor="expirationDate" className={labelClass}>
              Expiration date of EPD
            </label>
            <input
              id="expirationDate"
              type="date"
              value={processInfo.expirationDateOfEPD ?? ''}
              onChange={(e) =>
                updateProcessInfo({ expirationDateOfEPD: e.target.value || undefined })
              }
              className={`${inputClass} max-w-xs`}
              aria-label="Expiration date of EPD"
            />
          </div>
        )}

        {/* Product IDs (v1.3) */}
        {features.productIds && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={labelClass}>Product IDs (e.g. GTIN, GMN)</span>
              <button
                type="button"
                onClick={addProductId}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none"
              >
                + Add product ID
              </button>
            </div>

            {productIds.length === 0 && (
              <p className="text-sm text-gray-400 italic">No product IDs added.</p>
            )}

            <div className="space-y-2">
              {productIds.map((p, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[120px_1fr_auto] gap-3 items-center rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <select
                    value={p.type}
                    onChange={(e) => updateProductId(i, { type: e.target.value })}
                    className={inputClass}
                    aria-label={`Product ID type ${i + 1}`}
                  >
                    <option value="GTIN">GTIN</option>
                    <option value="GMN">GMN</option>
                    <option value="UPC">UPC</option>
                    <option value="other">other</option>
                  </select>
                  <input
                    type="text"
                    value={p.value}
                    onChange={(e) => updateProductId(i, { value: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. 3234567890126"
                    aria-label={`Product ID value ${i + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeProductId(i)}
                    className="text-red-400 hover:text-red-600 focus:outline-none text-lg leading-none px-2"
                    aria-label={`Remove product ID ${i + 1}`}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
