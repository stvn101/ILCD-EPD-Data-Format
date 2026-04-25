import { useMemo } from 'react';
import { useEPDStore } from '../../store/epd-store';
import type { Reference, BackgroundDatabase, BackgroundDbProvider } from '../../schema/types';
import { parseBackgroundDbCSV } from '../../schema/indicator-parser';
// Static ?raw imports resolved by Vite at bundle time.
import gabiCSV from '../../../../ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/BackgroundDB_SourceDatasets_GaBi.csv?raw';
import ecoinventCSV from '../../../../ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/BackgroundDB_SourceDatasets_ecoinvent.csv?raw';

function makeSourceRef(uuid: string, name: string): Reference {
  return {
    type: 'source data set',
    refObjectId: uuid,
    shortDescription: [{ lang: 'en', value: name }],
  };
}

function getRefName(ref: Reference | null): string {
  return ref?.shortDescription.find((m) => m.lang === 'en')?.value ?? '';
}

function getRefUuid(ref: Reference | null): string {
  return ref?.refObjectId ?? '';
}

// AusLCI — Australian Life Cycle Inventory (run by ALCAS).
// Not in the upstream ILCD-EPD spec catalogue, so hardcoded here. The UUIDs
// below are PLACEHOLDERS until AusLCI registers source-dataset UUIDs with
// EPD International / a recognised programme operator. Until then, Task 7's
// cross-reference validator will warn on these UUIDs (as designed —
// flags that an unregistered DB has been selected).
// TODO: replace with real registered UUIDs once AusLCI completes registration.
const AUSLCI_DATABASES: BackgroundDatabase[] = [
  {
    provider: 'AusLCI',
    databaseVersion: 'current',
    name: 'AusLCI database (current)',
    uuid: 'auslci-placeholder-current-0000-000000000001',
  },
];

function loadBackgroundDatabases(): Record<BackgroundDbProvider, BackgroundDatabase[]> {
  return {
    AusLCI: AUSLCI_DATABASES,
    GaBi: parseBackgroundDbCSV(gabiCSV, 'GaBi'),
    ecoinvent: parseBackgroundDbCSV(ecoinventCSV, 'ecoinvent'),
  };
}

export default function Step6Sources() {
  const sources = useEPDStore((s) => s.dataset.sources);
  const updateSources = useEPDStore((s) => s.updateSources);

  const backgroundDatabases = useMemo(loadBackgroundDatabases, []);

  const inputClass =
    'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500';
  const labelClass = 'block text-sm font-semibold text-gray-700 mb-1';

  // PCR
  const pcrName = getRefName(sources.pcr);
  const pcrUuid = getRefUuid(sources.pcr);

  function setPcr(name: string, uuid: string) {
    if (!name && !uuid) {
      updateSources({ pcr: null });
      return;
    }
    updateSources({ pcr: makeSourceRef(uuid, name) });
  }

  // Background database (first entry)
  const bgDb = sources.backgroundDatabases[0] ?? null;
  const selectedDbUuid = getRefUuid(bgDb);

  function setBackgroundDb(uuid: string) {
    if (!uuid) {
      updateSources({ backgroundDatabases: [] });
      return;
    }
    const all = [...backgroundDatabases.GaBi, ...backgroundDatabases.ecoinvent];
    const opt = all.find((o) => o.uuid === uuid);
    if (!opt) {
      updateSources({ backgroundDatabases: [] });
      return;
    }
    updateSources({ backgroundDatabases: [makeSourceRef(opt.uuid, opt.name)] });
  }

  // EPD document
  const epdName = getRefName(sources.epdDocument);
  const epdUuid = getRefUuid(sources.epdDocument);

  function setEpdDocument(name: string, uuid: string) {
    if (!name && !uuid) {
      updateSources({ epdDocument: null });
      return;
    }
    updateSources({ epdDocument: makeSourceRef(uuid, name) });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Sources &amp; References</h2>
        <p className="text-sm text-gray-500">
          Link the PCR, background database, and EPD document used for this dataset.
        </p>
      </div>

      <div className="space-y-6">
        {/* PCR */}
        <div id="sources.pcr" className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">PCR document</h3>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name</label>
            <input
              type="text"
              value={pcrName}
              onChange={(e) => setPcr(e.target.value, pcrUuid)}
              className={inputClass}
              aria-label="PCR document name"
              placeholder="e.g. PCR 2012:01 version 2.3"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">UUID</label>
            <input
              type="text"
              value={pcrUuid}
              onChange={(e) => setPcr(pcrName, e.target.value)}
              className={`${inputClass} font-mono text-xs`}
              aria-label="PCR UUID"
              placeholder="e.g. 00000000-0000-0000-0000-000000000000"
            />
          </div>
        </div>

        {/* Background database */}
        <div>
          <label htmlFor="backgroundDb" className={labelClass}>
            Background database
          </label>
          <select
            id="backgroundDb"
            value={selectedDbUuid}
            onChange={(e) => setBackgroundDb(e.target.value)}
            className={`${inputClass} max-w-sm`}
            aria-label="Background database"
          >
            <option value="">None selected</option>
            <optgroup label="AusLCI (Australian Life Cycle Inventory)">
              {backgroundDatabases.AusLCI.map((opt) => (
                <option key={opt.uuid} value={opt.uuid}>
                  {opt.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="GaBi / Sphera MLC">
              {backgroundDatabases.GaBi.map((opt) => (
                <option key={opt.uuid} value={opt.uuid}>
                  {opt.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="ecoinvent">
              {backgroundDatabases.ecoinvent.map((opt) => (
                <option key={opt.uuid} value={opt.uuid}>
                  {opt.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* EPD document */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">EPD document</h3>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name</label>
            <input
              type="text"
              value={epdName}
              onChange={(e) => setEpdDocument(e.target.value, epdUuid)}
              className={inputClass}
              aria-label="EPD document name"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">UUID</label>
            <input
              type="text"
              value={epdUuid}
              onChange={(e) => setEpdDocument(epdName, e.target.value)}
              className={`${inputClass} font-mono text-xs`}
              aria-label="EPD document UUID"
              placeholder="e.g. 00000000-0000-0000-0000-000000000000"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
