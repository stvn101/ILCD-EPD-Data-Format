import { v4 as uuidv4 } from 'uuid';
import { useEPDStore } from '../../store/epd-store';
import { STANDARD_CONFIGS } from '../../schema/standard-configs';
import type { Reference } from '../../schema/types';
import type { Site } from '../../model/epd-dataset';

function makeContactRef(uuid: string, name: string): Reference {
  return {
    type: 'contact data set',
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

interface OrgFieldProps {
  label: string;
  nameValue: string;
  uuidValue: string;
  onNameChange: (name: string) => void;
  onUuidChange: (uuid: string) => void;
  onGenerateUuid: () => void;
}

function OrgField({
  label,
  nameValue,
  uuidValue,
  onNameChange,
  onUuidChange,
  onGenerateUuid,
}: OrgFieldProps) {
  const inputClass =
    'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">{label}</h3>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Name (en)</label>
        <input
          type="text"
          value={nameValue}
          onChange={(e) => onNameChange(e.target.value)}
          className={inputClass}
          aria-label={`${label} name`}
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">UUID</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={uuidValue}
            onChange={(e) => onUuidChange(e.target.value)}
            className={`${inputClass} font-mono text-xs`}
            placeholder="e.g. 00000000-0000-0000-0000-000000000000"
            aria-label={`${label} UUID`}
          />
          <button
            type="button"
            onClick={onGenerateUuid}
            className="flex-shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 focus:outline-none"
            aria-label={`Generate UUID for ${label}`}
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Step4Organisations() {
  const organisations = useEPDStore((s) => s.dataset.organisations);
  const standardVersion = useEPDStore((s) => s.dataset.meta.standardVersion);
  const updateOrganisations = useEPDStore((s) => s.updateOrganisations);

  const features = STANDARD_CONFIGS[standardVersion].features;

  // Manufacturer (first entry or null)
  const manufacturer = organisations.manufacturers[0]?.contact ?? null;
  const mfrName = getRefName(manufacturer);
  const mfrUuid = getRefUuid(manufacturer);
  const mfrSites: Site[] = organisations.manufacturers[0]?.sites ?? [];

  function setManufacturer(name: string, uuid: string) {
    const ref = makeContactRef(uuid || uuidv4(), name);
    updateOrganisations({
      manufacturers:
        organisations.manufacturers.length > 0
          ? [{ ...organisations.manufacturers[0], contact: ref }]
          : [{ contact: ref, isProvidingData: true, sites: [] }],
    });
  }

  function ensureManufacturer() {
    if (organisations.manufacturers.length > 0) return organisations.manufacturers[0];
    const ref = makeContactRef(uuidv4(), '');
    const m = { contact: ref, isProvidingData: true, sites: [] };
    updateOrganisations({ manufacturers: [m] });
    return m;
  }

  function addSite() {
    const m = ensureManufacturer();
    updateOrganisations({
      manufacturers: [{ ...m, sites: [...m.sites, { name: '' }] }],
    });
  }
  function updateSite(i: number, patch: Partial<Site>) {
    const m = organisations.manufacturers[0];
    if (!m) return;
    const sites = m.sites.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    updateOrganisations({ manufacturers: [{ ...m, sites }] });
  }
  function removeSite(i: number) {
    const m = organisations.manufacturers[0];
    if (!m) return;
    updateOrganisations({
      manufacturers: [{ ...m, sites: m.sites.filter((_, idx) => idx !== i) }],
    });
  }

  const progOp = organisations.programmeOperator;
  const progOpName = getRefName(progOp);
  const progOpUuid = getRefUuid(progOp);

  function setProgrammeOperator(name: string, uuid: string) {
    updateOrganisations({ programmeOperator: makeContactRef(uuid || uuidv4(), name) });
  }

  const verifier = organisations.verifier;
  const verifierName = getRefName(verifier);
  const verifierUuid = getRefUuid(verifier);

  function setVerifier(name: string, uuid: string) {
    updateOrganisations({ verifier: makeContactRef(uuid || uuidv4(), name) });
  }

  const owner = organisations.ownerOfDataSet;
  const ownerName = getRefName(owner);
  const ownerUuid = getRefUuid(owner);

  function setOwner(name: string, uuid: string) {
    updateOrganisations({ ownerOfDataSet: makeContactRef(uuid || uuidv4(), name) });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Organisations</h2>
        <p className="text-sm text-gray-500">
          Identify the organisations involved in this EPD.
        </p>
      </div>

      <div className="space-y-4">
        <OrgField
          label="Manufacturer"
          nameValue={mfrName}
          uuidValue={mfrUuid}
          onNameChange={(name) => setManufacturer(name, mfrUuid)}
          onUuidChange={(uuid) => setManufacturer(mfrName, uuid)}
          onGenerateUuid={() => setManufacturer(mfrName, uuidv4())}
        />

        {/* Manufacturer sites (v1.3) */}
        {features.manufacturers && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Manufacturer sites</h3>
              <button
                type="button"
                onClick={addSite}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none"
              >
                + Add site
              </button>
            </div>

            {mfrSites.length === 0 && (
              <p className="text-sm text-gray-400 italic">No sites added.</p>
            )}

            {mfrSites.map((site, i) => {
              const inputClass =
                'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500';
              return (
                <div
                  key={i}
                  className="rounded-lg border border-gray-200 bg-white p-3 space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-500">Site {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeSite(i)}
                      className="text-red-400 hover:text-red-600 focus:outline-none text-lg leading-none"
                      aria-label={`Remove site ${i + 1}`}
                    >
                      &times;
                    </button>
                  </div>
                  <input
                    type="text"
                    value={site.name}
                    onChange={(e) => updateSite(i, { name: e.target.value })}
                    placeholder="Site name (required)"
                    className={inputClass}
                    aria-label={`Site ${i + 1} name`}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={site.facilityIdentifier ?? ''}
                      onChange={(e) =>
                        updateSite(i, { facilityIdentifier: e.target.value || undefined })
                      }
                      placeholder="Facility identifier"
                      className={inputClass}
                      aria-label={`Site ${i + 1} facility identifier`}
                    />
                    <input
                      type="text"
                      value={site.geoCode ?? ''}
                      onChange={(e) =>
                        updateSite(i, { geoCode: e.target.value || undefined })
                      }
                      placeholder="Geo code (e.g. DE)"
                      maxLength={3}
                      className={`${inputClass} uppercase`}
                      aria-label={`Site ${i + 1} geo code`}
                    />
                  </div>
                  <input
                    type="text"
                    value={site.olc ?? ''}
                    onChange={(e) => updateSite(i, { olc: e.target.value || undefined })}
                    placeholder="Open Location Code (e.g. 9F28WXR4+FW2)"
                    className={inputClass}
                    aria-label={`Site ${i + 1} OLC`}
                  />
                  <input
                    type="text"
                    value={site.streetAddress ?? ''}
                    onChange={(e) =>
                      updateSite(i, { streetAddress: e.target.value || undefined })
                    }
                    placeholder="Street address"
                    className={inputClass}
                    aria-label={`Site ${i + 1} street address`}
                  />
                </div>
              );
            })}
          </div>
        )}

        <OrgField
          label="Programme operator"
          nameValue={progOpName}
          uuidValue={progOpUuid}
          onNameChange={(name) => setProgrammeOperator(name, progOpUuid)}
          onUuidChange={(uuid) => setProgrammeOperator(progOpName, uuid)}
          onGenerateUuid={() => setProgrammeOperator(progOpName, uuidv4())}
        />

        <OrgField
          label="Verifier"
          nameValue={verifierName}
          uuidValue={verifierUuid}
          onNameChange={(name) => setVerifier(name, verifierUuid)}
          onUuidChange={(uuid) => setVerifier(verifierName, uuid)}
          onGenerateUuid={() => setVerifier(verifierName, uuidv4())}
        />

        <OrgField
          label="Data owner"
          nameValue={ownerName}
          uuidValue={ownerUuid}
          onNameChange={(name) => setOwner(name, ownerUuid)}
          onUuidChange={(uuid) => setOwner(ownerName, uuid)}
          onGenerateUuid={() => setOwner(ownerName, uuidv4())}
        />
      </div>
    </div>
  );
}
