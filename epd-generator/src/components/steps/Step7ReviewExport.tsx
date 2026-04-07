import { useState, useMemo } from 'react';
import { useEPDStore } from '../../store/epd-store';
import { generateProcessXML } from '../../generators/xml/process-xml';
import { generateJSON } from '../../generators/json-generator';
import { generateILCDZip } from '../../generators/zip-generator';
import { validateDataset } from '../../validation/validator';

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface InfoCardProps {
  title: string;
  children: React.ReactNode;
}

function InfoCard({ title, children }: InfoCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

interface InfoRowProps {
  label: string;
  value: React.ReactNode;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 font-medium text-right break-all">{value}</span>
    </div>
  );
}

export default function Step7ReviewExport() {
  const dataset = useEPDStore((s) => s.dataset);
  const [status, setStatus] = useState<string | null>(null);

  const validation = useMemo(() => validateDataset(dataset), [dataset]);
  const hasErrors = validation.errors.length > 0;

  const uuid = dataset.meta.uuid;
  const productNameEn =
    dataset.productFlow.name.find((n) => n.lang === 'en')?.value ||
    dataset.productFlow.name[0]?.value ||
    '(unnamed)';
  const declaredModules =
    dataset.declaredModules.size > 0
      ? Array.from(dataset.declaredModules).join(', ')
      : '(none declared)';

  async function handleExportXML() {
    setStatus(null);
    try {
      const xml = generateProcessXML(dataset);
      downloadFile(`${uuid}.xml`, xml, 'application/xml');
      setStatus('XML exported successfully.');
    } catch (err) {
      setStatus(`XML export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleExportZip() {
    setStatus(null);
    try {
      const blob = await generateILCDZip(dataset);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ILCD_${uuid}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('ILCD ZIP exported successfully.');
    } catch (err) {
      setStatus(`ZIP export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleExportJSON() {
    setStatus(null);
    try {
      const json = generateJSON(dataset);
      downloadFile(`${uuid}.json`, json, 'application/json');
      setStatus('JSON exported successfully.');
    } catch (err) {
      setStatus(`JSON export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-gray-900">Step 7: Review &amp; Export</h2>

      {/* Review Section */}
      <section>
        <h3 className="text-lg font-medium text-gray-800 mb-4">Dataset Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Dataset Info */}
          <InfoCard title="Dataset Info">
            <InfoRow label="UUID" value={<span className="font-mono text-xs">{dataset.meta.uuid}</span>} />
            <InfoRow label="Standard Version" value={dataset.meta.standardVersion} />
            <InfoRow label="Sub-type" value={dataset.meta.subType} />
            <InfoRow label="Version" value={dataset.meta.dataSetVersion} />
          </InfoCard>

          {/* Product */}
          <InfoCard title="Product">
            <InfoRow label="Name (en)" value={productNameEn || '(not set)'} />
            <InfoRow label="Location" value={dataset.processInfo.location || '(not set)'} />
            <InfoRow label="Reference Year" value={dataset.processInfo.referenceYear} />
          </InfoCard>

          {/* Modules */}
          <InfoCard title="Modules">
            <div className="text-sm text-gray-900 font-medium break-words">
              {declaredModules}
            </div>
          </InfoCard>

          {/* Data Counts */}
          <InfoCard title="Data">
            <InfoRow label="Exchanges" value={dataset.exchanges.length} />
            <InfoRow label="LCIA Results" value={dataset.lciaResults.length} />
          </InfoCard>
        </div>
      </section>

      {/* Validation Section */}
      {validation.issues.length > 0 && (
        <section>
          <h3 className="text-lg font-medium text-gray-800 mb-3">Validation</h3>
          <div className="space-y-2">
            {validation.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700 mb-2">
                  Errors — export is disabled until these are resolved:
                </p>
                <ul className="space-y-1">
                  {validation.errors.map((issue, i) => (
                    <li key={i} className="text-sm text-red-700 flex gap-2">
                      <span className="font-medium shrink-0">Step {issue.step} &bull; {issue.field}:</span>
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {validation.warnings.length > 0 && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <p className="text-sm font-semibold text-yellow-800 mb-2">
                  Warnings — export is allowed but consider addressing these:
                </p>
                <ul className="space-y-1">
                  {validation.warnings.map((issue, i) => (
                    <li key={i} className="text-sm text-yellow-800 flex gap-2">
                      <span className="font-medium shrink-0">Step {issue.step} &bull; {issue.field}:</span>
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Export Section */}
      <section>
        <h3 className="text-lg font-medium text-gray-800 mb-4">Export</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportXML}
            disabled={hasErrors}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export XML
          </button>

          <button
            onClick={handleExportZip}
            disabled={hasErrors}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export ILCD ZIP
          </button>

          <button
            onClick={handleExportJSON}
            disabled={hasErrors}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export JSON
          </button>
        </div>

        {status && (
          <p
            className={`mt-4 text-sm font-medium ${
              status.includes('failed') ? 'text-red-600' : 'text-green-700'
            }`}
          >
            {status}
          </p>
        )}
      </section>
    </div>
  );
}
