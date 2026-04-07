import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useEPDStore } from '../../store/epd-store';
import type { Reference } from '../../schema/types';

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
  const updateOrganisations = useEPDStore((s) => s.updateOrganisations);

  // Manufacturer (first entry or null)
  const manufacturer = organisations.manufacturers[0]?.contact ?? null;
  const mfrName = getRefName(manufacturer);
  const mfrUuid = getRefUuid(manufacturer);

  function setManufacturer(name: string, uuid: string) {
    const ref = makeContactRef(uuid || uuidv4(), name);
    updateOrganisations({
      manufacturers:
        organisations.manufacturers.length > 0
          ? [{ ...organisations.manufacturers[0], contact: ref }]
          : [{ contact: ref, isProvidingData: true, sites: [] }],
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
